// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title Forum
 * @notice 3Can — minimal decentralised forum. Threads and posts reference IPFS
 *         CIDs for their body content; the chain stores only authorship,
 *         timestamp, parent thread, and vote tally. Append-only: no edit, no
 *         delete, no admin functions.
 */
contract Forum {
    struct Thread {
        uint256 id;
        address author;
        string contentHash;
        uint256 timestamp;
    }

    struct Post {
        uint256 id;
        uint256 threadId;
        address author;
        string contentHash;
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
            id: id,
            author: msg.sender,
            contentHash: cid,
            timestamp: block.timestamp
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
        if (_posts[postId].author == address(0)) {
            revert PostDoesNotExist(postId);
        }
        if (hasVoted[postId][msg.sender]) revert AlreadyVoted();

        hasVoted[postId][msg.sender] = true;
        uint256 newVotes = _posts[postId].votes + 1;
        _posts[postId].votes = newVotes;

        emit PostVoted(postId, msg.sender, newVotes);
    }

    function getThread(uint256 threadId) external view returns (Thread memory) {
        if (_threads[threadId].author == address(0)) {
            revert ThreadDoesNotExist(threadId);
        }
        return _threads[threadId];
    }

    function getPost(uint256 postId) external view returns (Post memory) {
        if (_posts[postId].author == address(0)) {
            revert PostDoesNotExist(postId);
        }
        return _posts[postId];
    }

    function threadCount() external view returns (uint256) {
        return nextThreadId - 1;
    }

    function postCount() external view returns (uint256) {
        return nextPostId - 1;
    }
}
