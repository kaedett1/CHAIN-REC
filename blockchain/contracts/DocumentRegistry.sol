// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract DocumentRegistry {
    // The account allowed to register documents (your backend's wallet)
    address public owner;

    struct Record {
        uint256 timestamp;     // when it was registered (0 means "not registered")
        address registeredBy;  // which account registered it
    }

    // document hash => its record
    mapping(bytes32 => Record) private records;

    uint256 public totalDocuments;

    event DocumentRegistered(
        bytes32 indexed docHash,
        address indexed registeredBy,
        uint256 timestamp
    );

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can register documents");
        _;
    }

    // Save a document's hash. Costs gas (free on a test network).
    function storeHash(bytes32 docHash) external onlyOwner {
        require(records[docHash].timestamp == 0, "Document already registered");

        records[docHash] = Record(block.timestamp, msg.sender);
        totalDocuments += 1;

        emit DocumentRegistered(docHash, msg.sender, block.timestamp);
    }

    // Check a hash. Free to call, because it only reads data.
    function verifyHash(bytes32 docHash)
        external
        view
        returns (bool exists, uint256 timestamp, address registeredBy)
    {
        Record memory rec = records[docHash];
        return (rec.timestamp != 0, rec.timestamp, rec.registeredBy);
    }
}