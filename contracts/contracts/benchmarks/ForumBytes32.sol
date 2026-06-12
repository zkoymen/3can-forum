// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title ForumBytes32
 * @notice CID-as-bytes32 variant of {Forum}, used ONLY for the
 *         "string vs bytes32 CID" gas benchmark required by proposal §4.3.
 *         NEVER deployed. The field ORDER is left identical to {Forum} so the
 *         only variable under test is the content-hash type (`bytes32` instead
 *         of `string`). This isolates the storage/calldata cost of the type
 *         change from any packing effect.
 *
 *         Why the deployed contract still uses `string`: a real CIDv1 in base32
 *         is 59 characters and does NOT fit in 32 bytes. Storing it as `bytes32`
 *         would require carrying the raw multihash digest plus a codec/prefix on
 *         the client and reconstructing the printable CID for every gateway
 *         fetch and Etherscan inspection. This benchmark measures exactly what
 *         that complexity would buy, so the decision is evidence-based.
 */
contract ForumBytes32 {
    struct Thread {
        uint256 id;
        address author;
        bytes32 contentHash;
        uint256 timestamp;
    }

    struct Post {
        uint256 id;
        uint256 threadId;
        address author;
        bytes32 contentHash;
        uint256 timestamp;
        uint256 votes;
    }

    uint256 public nextThreadId = 1;
    uint256 public nextPostId = 1;

    mapping(uint256 => Thread) private _threads;
    mapping(uint256 => Post) private _posts;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ThreadCreated(
        uint256 indexed threadId,
        address indexed author,
        bytes32 cid,
        uint256 timestamp
    );
    event PostCreated(
        uint256 indexed postId,
        uint256 indexed threadId,
        address indexed author,
        bytes32 cid,
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

    function createThread(bytes32 cid) external returns (uint256) {
        if (cid == bytes32(0)) revert EmptyCid();

        uint256 id = nextThreadId;
        nextThreadId = id + 1;

        _threads[id] = Thread({
            id: id,
            author: msg.sender,
            contentHash: cid,
            timestamp: block.timestamp
        });

        emit ThreadCreated(id, msg.sender, cid, block.timestamp);
        return id;
    }

    function createPost(uint256 threadId, bytes32 cid)
        external
        returns (uint256)
    {
        if (cid == bytes32(0)) revert EmptyCid();
        if (_threads[threadId].author == address(0)) {
            revert ThreadDoesNotExist(threadId);
        }

        uint256 id = nextPostId;
        nextPostId = id + 1;

        _posts[id] = Post({
            id: id,
            threadId: threadId,
            author: msg.sender,
            contentHash: cid,
            timestamp: block.timestamp,
            votes: 0
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
