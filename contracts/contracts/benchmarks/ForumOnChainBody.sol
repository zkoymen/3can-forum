// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title ForumOnChainBody
 * @notice "Naïve baseline" variant that stores the FULL post/thread body on
 *         chain instead of an IPFS CID. Used ONLY for the naïve-baseline gas
 *         comparison required by proposal §4.3 (quantifying the saving of the
 *         hybrid on-chain/off-chain design from proposal §1.3). NEVER deployed.
 *
 *         Structurally identical to {Forum}; the only difference is that the
 *         `string body` holds the entire human-readable content rather than a
 *         ~59-byte CID. Driving `createPost` with a realistic multi-hundred-byte
 *         body shows the per-write cost exploding by roughly two orders of
 *         magnitude — which is the empirical justification for anchoring only
 *         the CID on chain and keeping the body on IPFS.
 */
contract ForumOnChainBody {
    struct Thread {
        uint256 id;
        address author;
        string body;
        uint256 timestamp;
    }

    struct Post {
        uint256 id;
        uint256 threadId;
        address author;
        string body;
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
        uint256 bodyLength,
        uint256 timestamp
    );
    event PostCreated(
        uint256 indexed postId,
        uint256 indexed threadId,
        address indexed author,
        uint256 bodyLength,
        uint256 timestamp
    );

    error EmptyBody();
    error ThreadDoesNotExist(uint256 threadId);

    function createThread(string calldata body) external returns (uint256) {
        if (bytes(body).length == 0) revert EmptyBody();

        uint256 id = nextThreadId;
        nextThreadId = id + 1;

        _threads[id] = Thread({
            id: id,
            author: msg.sender,
            body: body,
            timestamp: block.timestamp
        });

        emit ThreadCreated(id, msg.sender, bytes(body).length, block.timestamp);
        return id;
    }

    function createPost(uint256 threadId, string calldata body)
        external
        returns (uint256)
    {
        if (bytes(body).length == 0) revert EmptyBody();
        if (_threads[threadId].author == address(0)) {
            revert ThreadDoesNotExist(threadId);
        }

        uint256 id = nextPostId;
        nextPostId = id + 1;

        _posts[id] = Post({
            id: id,
            threadId: threadId,
            author: msg.sender,
            body: body,
            timestamp: block.timestamp,
            votes: 0
        });

        emit PostCreated(id, threadId, msg.sender, bytes(body).length, block.timestamp);
        return id;
    }
}
