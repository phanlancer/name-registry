// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
pragma experimental "ABIEncoderV2";

import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title NameRegistry
 * @author Phan Trung Sinh
 *
 * Smart contract for name registering system resistant against frontrunning
 */
contract NameRegistry is ReentrancyGuard {
    using ECDSA for bytes32;

    /* ============ Structs ============ */

    struct NameCommit {
        bytes32 nameHash;
        uint256 blockNumber;
    }

    struct Name {
        address owner;
        bytes32 name;
        uint256 registeredTime;
    }


    /* ============ Events ============ */

    event NameCommited(bytes32 _nameHash, uint256 _blockNumber);
    event NameRegistered(address indexed _owner, string _name, uint256 _registeredTime);
    event NameRenewed(address indexed _owner, string _name, uint256 _renewedTime);

    /* ============ State Variables ============ */

    uint256 immutable public lockDuration;
    uint256 immutable public lockAmount;
    uint256 immutable public blockFreeze;   // Name registration is available after some blocks of the commitment
    uint256 immutable public feeAmount;
    address public feeRecipient;

    NameCommit[] public nameCommits;
    Name[] public names;

    /* ============ Constructer ============ */

    /**
     * Initialize NameRegistry contract
     *
     * @param _lockDuration         One time name registration lock duration
     * @param _lockAmount           Amount to lock when register a name
     * @param _blockFreeze            Number of blocks for the registration after the commitment
     * @param _feeAmount            Fee amount to pay when register a name
     * @param _feeRecipient         Address to receive the fee
     */
    constructor(
        uint256 _lockDuration,
        uint256 _lockAmount,
        uint256 _blockFreeze,
        uint256 _feeAmount,
        address _feeRecipient
    ) {
        require(_lockDuration > 0, "invalid lock duration");
        require(_lockAmount > 0, "invalid lock amount");
        require(_blockFreeze > 0, "invalid freeze blocks");
        require(_feeAmount > 0, "invalid fee amount");
        require(_feeRecipient != address(0), "invalid fee recipient");

        lockDuration = _lockDuration;
        lockAmount = _lockAmount;
        feeAmount = _feeAmount;
        blockFreeze = _blockFreeze;
        feeRecipient = _feeRecipient;
    }

    /* ============ Public/External Functions ============ */

    /**
     * Commit name hash which including 
     *
     * @param _nameHash             Hash of the name
     */
    function commitName(
        bytes32 _nameHash
    ) external {
        require(_nameHash != 0x0, "invalid hash");
        uint256 currentBlockNumber = block.number;
        nameCommits.push(NameCommit({
            nameHash: _nameHash,
            blockNumber: currentBlockNumber
        }));

        emit NameCommited(_nameHash, currentBlockNumber);

        // for now, don't call unlockCall() for gas saving
        // unlockNames();
    }

    /**
     * Reveal and register Name
     *
     * @param _name                 Real name
     */
    function registerName(
        string memory _name,
        bytes memory _signature
    ) external payable nonReentrant {
        require(msg.value >= lockAmount + feeAmount, "insufficient amount");

        bytes32 nameHash = getNameHash(msg.sender, _name);
        // check if nameHash is included in the nameCommits
        (uint256 indexCommit, bool isFoundCommit) = _indexOfNameCommits(nameHash);
        require(isFoundCommit, "not commited name");
        
        uint256 commitedBlockNumber = nameCommits[indexCommit].blockNumber;
        require(commitedBlockNumber + blockFreeze < block.number, "should register after some blocks");

        bytes32 signedHash = nameHash.toEthSignedMessageHash();
        address signer = signedHash.recover(_signature);
        require(signer == msg.sender, "invalid signer");

        // register name
        bytes32 nameBytes = _stringToBytes32(_name);
        (, bool isFoundName) = _indexOfNames(nameBytes);
        require(!isFoundName, "already registered");
        names.push(Name({ owner:signer, name:nameBytes, registeredTime: block.timestamp }));
        // remove name commitment
        _removeNameCommitsAt(indexCommit);

        // send fee
        (bool sentFee, ) = feeRecipient.call{value: feeAmount}("");
        require(sentFee, "failed to send ether");

        // refund remaining
        if (msg.value > lockAmount + feeAmount) {
            (bool sentRemainng, ) = msg.sender.call{value: msg.value - lockAmount - feeAmount }("");
            require(sentRemainng, "failed to send remaining ether");
        }

        emit NameRegistered(signer, _name, block.timestamp);

        // for now, don't call unlockCall() for gas saving
        // unlockNames();
    }

    /**
     * Renew ownership of the name
     *
     * @param _name                 Real name
     */
    function renewName(string memory _name) external payable nonReentrant {
        require(msg.value >= feeAmount, "insufficient fee");
        require(bytes(_name).length <= 32, "name size should be less than 32 bytes");

        bytes32 nameBytes = _stringToBytes32(_name);
        (uint256 index, bool isFound) = _indexOfNames(nameBytes);
        require(isFound, "name not found");

        Name storage nameData = names[index];
        require(nameData.owner == msg.sender, "not the owner");

        uint256 currentTime = block.timestamp;
        require(nameData.registeredTime + lockDuration > currentTime, "registration expired already");

        nameData.registeredTime = currentTime;

        // send fee
        (bool sentFee, ) = feeRecipient.call{value: feeAmount}("");
        require(sentFee, "failed to send ether");

        // refund remaining
        if (msg.value > feeAmount) {
            (bool sentRemainng, ) = msg.sender.call{value: msg.value - feeAmount }("");
            require(sentRemainng, "failed to send remaining ether");
        }

        emit NameRenewed(msg.sender, _name, currentTime);

        // for now, don't call unlockCall() for gas saving
        // unlockNames();
    }

    /**
     * Unlock names
     */
    function unlockNames() public nonReentrant {
        uint256 length = names.length;
        uint256 currentTime = block.timestamp;
        for (uint256 i = 0; i < length; i++) {
            if (names[i].registeredTime + lockDuration <= currentTime) {
                address previousOwner = names[i].owner;
                _removeNamesAt(i);

                // unlock previous owners balance
                (bool sent, ) = previousOwner.call{ value: lockAmount }("");
                require(sent, "failed to send ether");
            }
        }
    }

    /* ============ Public/External Getter Functions ============ */

    function getNameHash(address _user, string memory _name) public pure returns (bytes32) {
        require(_user != address(0), "invalid fee recipient");
        require(bytes(_name).length <= 32, "name size should be less than 32 bytes");
        return keccak256(abi.encodePacked(_user, _name));
    }

    function getSignedHash(bytes32 _hash) public pure returns (bytes32) {
        bytes32 signedHash = _hash.toEthSignedMessageHash();
        return signedHash;
    }

    function getTotalNames() public view returns (uint256) {
        return names.length;
    }

    function getTotalNameCommits() public view returns (uint256) {
        return nameCommits.length;
    }

    function getNameIndex(string memory _name) public view returns (uint256) {
        bytes32 nameBytes = _stringToBytes32(_name);
        (uint256 index, ) = _indexOfNames(nameBytes);
        return index;
    }

    /* ============ Internal Functions ============ */

    /**
     * Finds the index of the first occurrence of the given element in nameCommits
     *
     * @param _nameHash             The value to find
     *
     * @return                      Returns (index and isIn) for the first occurrence starting from index 0
     */
    function _indexOfNameCommits(bytes32 _nameHash) internal view returns (uint256, bool) {
        uint256 length = nameCommits.length;
        for (uint256 i = 0; i < length; i++) {
            if (nameCommits[i].nameHash == _nameHash) {
                return (i, true);
            }
        }
        return (type(uint256).max, false);
    }

    /**
     * Finds the index of the first occurrence of the given element in names
     *
     * @param _name                 The value to find
     *
     * @return                      Returns (index and isIn) for the first occurrence starting from index 0
     */
    function _indexOfNames(bytes32 _name) internal view returns (uint256, bool) {
        uint256 length = names.length;
        for (uint256 i = 0; i < length; i++) {
            if (names[i].name == _name) {
                return (i, true);
            }
        }
        return (type(uint256).max, false);
    }

    /**
    * Removes specified index from nameCommits array
    *
    * @param _index                 The index to remove
    *
    * @return                       Success or failure
    */
    function _removeNameCommitsAt(uint256 _index) internal returns (bool) {
        uint256 length = nameCommits.length;
        if (_index >= length) return false;

        for (uint i = _index; i < length - 1; i++){
            nameCommits[i] = nameCommits[i+1];
        }
        nameCommits.pop();
        return true;
    }

    /**
    * Removes specified index from names array
    *
    * @param _index                 The index to remove
    *
    * @return                       Success or failure
    */
    function _removeNamesAt(uint256 _index) internal returns (bool) {
        uint256 length = names.length;
        if (_index >= length) return false;

        for (uint i = _index; i < length - 1; i++){
            names[i] = names[i+1];
        }
        names.pop();
        return true;
    }

    /**
    * Convert string to bytes32
    *
    * @param _source                Source string
    *
    * @return result                bytes32 converted from the source string
    */
    function _stringToBytes32(string memory _source) internal pure returns (bytes32 result) {
        bytes memory tempEmptyStringTest = bytes(_source);
        if (tempEmptyStringTest.length == 0) {
            return 0x0;
        }

        assembly {
            result := mload(add(_source, 32))
        }
    }
}
