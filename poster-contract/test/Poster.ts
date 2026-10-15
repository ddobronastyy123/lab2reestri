import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { keccak256, toBytes } from "viem";

describe("Poster", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const walletClients = await viem.getWalletClients();

  const creator = walletClients[0];
  const creatorAddress = creator.account.address;

  it("post ok", async function () {
    const poster = await viem.deployContract("Poster");

    // До поста событий нет
    const deploymentBlock = await publicClient.getBlockNumber();
    const eventsBefore = await publicClient.getContractEvents({
      address: poster.address,
      abi: poster.abi,
      eventName: "NewPost",
      fromBlock: deploymentBlock,
      strict: true,
    });
    assert.deepEqual(eventsBefore, []);

    // Пост
    const content = "Hello, world!";
    const tag = "hello";
    await poster.write.post([content, tag], { account: creator.account });

    // После поста одно событие
    const eventsAfter = await publicClient.getContractEvents({
      address: poster.address,
      abi: poster.abi,
      eventName: "NewPost",
      fromBlock: deploymentBlock,
      strict: true,
    });
    assert.equal(eventsAfter.length, 1);

    const posted = eventsAfter[0];
    assert.equal(
      posted.args.user.toLowerCase(),
      creatorAddress.toLowerCase()
    );
    assert.equal(posted.args.content, content);
    assert.equal(posted.args.tag, keccak256(toBytes(tag)));
    assert.equal(posted.args.tagText, tag);
  });
});