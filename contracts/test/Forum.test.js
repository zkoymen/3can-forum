const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Forum", function () {
  let forum;
  let owner;
  let alice;
  let bob;

  const SAMPLE_CID_A = "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
  const SAMPLE_CID_B = "bafkreidx2hzqsj5cijhrhfgb6ulwm6csz74j6mtolxazwq4abpcvc3svqi";

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();
    const Forum = await ethers.getContractFactory("Forum");
    forum = await Forum.deploy();
    await forum.waitForDeployment();
  });

  describe("createThread", function () {
    it("creates a thread and emits ThreadCreated", async function () {
      await expect(forum.connect(alice).createThread(SAMPLE_CID_A))
        .to.emit(forum, "ThreadCreated")
        .withArgs(1n, alice.address, SAMPLE_CID_A, anyUint());

      const thread = await forum.getThread(1);
      expect(thread.id).to.equal(1n);
      expect(thread.author).to.equal(alice.address);
      expect(thread.contentHash).to.equal(SAMPLE_CID_A);
    });

    it("reverts on empty CID", async function () {
      await expect(forum.createThread(""))
        .to.be.revertedWithCustomError(forum, "EmptyCid");
    });

    it("auto-increments thread ids", async function () {
      await forum.createThread(SAMPLE_CID_A);
      await forum.createThread(SAMPLE_CID_B);
      expect(await forum.threadCount()).to.equal(2n);
    });
  });

  describe("createPost", function () {
    beforeEach(async function () {
      await forum.connect(alice).createThread(SAMPLE_CID_A);
    });

    it("creates a post under an existing thread and emits PostCreated", async function () {
      await expect(forum.connect(bob).createPost(1, SAMPLE_CID_B))
        .to.emit(forum, "PostCreated")
        .withArgs(1n, 1n, bob.address, SAMPLE_CID_B, anyUint());

      const post = await forum.getPost(1);
      expect(post.threadId).to.equal(1n);
      expect(post.author).to.equal(bob.address);
      expect(post.votes).to.equal(0n);
    });

    it("reverts when posting to a non-existent thread", async function () {
      await expect(forum.createPost(999, SAMPLE_CID_B))
        .to.be.revertedWithCustomError(forum, "ThreadDoesNotExist")
        .withArgs(999n);
    });

    it("reverts on empty CID", async function () {
      await expect(forum.createPost(1, ""))
        .to.be.revertedWithCustomError(forum, "EmptyCid");
    });
  });

  describe("upvote", function () {
    beforeEach(async function () {
      await forum.connect(alice).createThread(SAMPLE_CID_A);
      await forum.connect(bob).createPost(1, SAMPLE_CID_B);
    });

    it("increments the vote count and emits PostVoted", async function () {
      await expect(forum.connect(alice).upvote(1))
        .to.emit(forum, "PostVoted")
        .withArgs(1n, alice.address, 1n);

      const post = await forum.getPost(1);
      expect(post.votes).to.equal(1n);
    });

    it("prevents the same wallet from voting twice", async function () {
      await forum.connect(alice).upvote(1);
      await expect(forum.connect(alice).upvote(1))
        .to.be.revertedWithCustomError(forum, "AlreadyVoted");
    });

    it("allows different wallets to vote on the same post", async function () {
      await forum.connect(alice).upvote(1);
      await forum.connect(bob).upvote(1);
      const post = await forum.getPost(1);
      expect(post.votes).to.equal(2n);
    });

    it("reverts when voting on a non-existent post", async function () {
      await expect(forum.upvote(999))
        .to.be.revertedWithCustomError(forum, "PostDoesNotExist")
        .withArgs(999n);
    });
  });
});

function anyUint() {
  return (value) => typeof value === "bigint" && value > 0n;
}
