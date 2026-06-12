// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title ForumPacked
 * @notice Storage-packed variant of {Forum}, used ONLY for the struct-packing
 *         gas benchmark required by proposal §4.3. This contract is NEVER
 *         deployed to any network — it exists so `scripts/gas-benchmark.js` can
 *         measure the saving from reordering scalar struct fields so that an
 *         `address` (20 bytes) shares a 32-byte storage slot with a `uint96`
 *         timestamp, and the two id fields share a single slot. Every cold
 *         storage slot avoided on a create path saves ~20k gas (SSTORE-from-zero).
 *
 *         The external interface (functions, events, custom errors) is identical
 *         to {Forum} so the benchmark harness can drive both contracts the same
 *         way. The deployed forum keeps the natural, human-readable field order;
 *         this file only quantifies the trade-off we chose against.
 */
contract ForumPacked {
    struct Thread {
        address author;     // ┐ slot 0: 20 bytes
        uint96 timestamp;   // ┘ slot 0: 12 bytes  (packed with author)
        uint256 id;         //   slot 1
        string contentHash; //   slot 2+ (dynamic)
    }

    struct Post {
        uint128 id;         // ┐ slot 0: 16 bytes
        uint128 threadId;   // ┘ slot 0: 16 bytes  (packed)
        address author;     // ┐ slot 1: 20 bytes
        uint96 timestamp;   // ┘ slot 1: 12 bytes  (packed with author)
        uint256 votes;      //   slot 2
        string contentHash; //   slot 3+ (dynamic)
    }

    uint256 public nextThreadId = 1;
    uint256 public nextPostId = 1;

    mapping(uint256 => Thread) private _threads;
    mapping(uint256 => Post) private _posts;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ThreadCreated(
        uint256 indexed threadId,
        address indexed author,
        string cid,
        uint256 timestamp
    );
    event PostCreated(
        uint256 indexed postId,
        uint256 indexed threadId,
        address indexed author,
        string cid,
        uint256 timestamp
    );
    event PostVoted(
        uint256 indexed postId,
        address indexed voter,
        uint256 newVoteCount
    );

    error EmptyCid();
    error ThreadDoesNotExist(uint256 threadId);
    error PostDoesNotExist(uint256 postId);
    error AlreadyVoted();

    function createThread(string calldata cid) external returns (uint256) {
        if (bytes(cid).length == 0) revert EmptyCid();

        uint256 id = nextThreadId;
        nextThreadId = id + 1;

        _threads[id] = Thread({
            author: msg.sender,
            timestamp: uint96(block.timestamp),
            id: id,
            contentHash: cid
        });

        emit ThreadCreated(id, msg.sender, cid, block.timestamp);
        return id;
    }

    function createPost(uint256 threadId, string calldata cid)
        external
        returns (uint256)
    {
        if (bytes(cid).length == 0) revert EmptyCid();
        if (_threads[threadId].author == address(0)) {
            revert ThreadDoesNotExist(threadId);
        }

        uint256 id = nextPostId;
        nextPostId = id + 1;

        _posts[id] = Post({
            id: uint128(id),
            threadId: uint128(threadId),
            author: msg.sender,
            timestamp: uint96(block.timestamp),
            votes: 0,
            contentHash: cid
        });

        emit PostCreated(id, threadId, msg.sender, cid, block.timestamp);
        return id;
    }

    function upvote(uint256 postId) external {
        if (_posts[postId].author == address(0)) revert PostDoesNotExist(postId);
        if (hasVoted[postId][msg.sender]) revert AlreadyVoted();

        hasVoted[postId][msg.sender] = true;
        uint256 newVotes = _posts[postId].votes + 1;
        _posts[postId].votes = newVotes;

        emit PostVoted(postId, msg.sender, newVotes);
    }
}
