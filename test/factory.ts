import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

const toWei = (value: number) => ethers.utils.parseEther(value.toString());

describe("Factory", () => {
    async function deploy() {
        // Contracts are deployed using the first signer/account by default
        const [owner, account] = await ethers.getSigners();

        const Token = await ethers.getContractFactory("Token");
        const token = await Token.deploy("Token", "TKN", toWei(1000000));
        await token.deployed();

        const factoryContract = await ethers.getContractFactory("Factory");
        const factory = await factoryContract.deploy();

        return { factory, owner, account, token };
    }

    describe("createExchange", () => {
        it("deploys an exchange", async () => {
            const { factory, token } = await loadFixture(deploy);
            const exchangeAddress = await factory.callStatic.createExchange(
                token.address
            );
            await factory.createExchange(token.address);

            expect(await factory.getExchange(token.address)).to.equal(
                exchangeAddress
            );

            const Exchange = await ethers.getContractFactory("Exchange");
            const exchange = await Exchange.attach(exchangeAddress);
            expect(await exchange.factory()).to.equal(factory.address);
        });

        it("doesn't allow zero address", async () => {
            const { factory, token } = await loadFixture(deploy);
            await expect(
                factory.createExchange("0x0000000000000000000000000000000000000000")
            ).to.be.revertedWith("invalid token address");
        });

        it("fails when exchange exists", async () => {
            const { factory, token } = await loadFixture(deploy);
            await factory.createExchange(token.address);
            await expect(factory.createExchange(token.address)).to.be.revertedWith(
                "exchange already exists"
            );
        });
    });

    describe("getExchange", () => {
        it("returns exchange address by token address", async () => {
            const { factory, token } = await loadFixture(deploy);
            const exchangeAddress = await factory.callStatic.createExchange(
                token.address
            );
            await factory.createExchange(token.address);
            expect(await factory.getExchange(token.address)).to.equal(
                exchangeAddress
            );
        });
    });
});