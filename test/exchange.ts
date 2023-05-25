import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { Exchange, Token } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";

const toWei = (value: number) => ethers.utils.parseEther(value.toString());

const fromWei = (value: number) =>
    ethers.utils.formatEther(
        typeof value === "string" ? value : value.toString()
    );

const getBalance = ethers.provider.getBalance;

const DEADLINE = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

describe("Exchange", () => {
    async function deploy() {
        // Contracts are deployed using the first signer/account by default
        const [owner, user] = await ethers.getSigners();

        const Token = await ethers.getContractFactory("Token");
        const token = await Token.deploy("Token", "TKN", toWei(1000000));
        await token.deployed();

        const factoryContract = await ethers.getContractFactory("Factory");
        const factory = await factoryContract.deploy();
        const exchangeAddress = await factory.callStatic.createExchange(
            token.address
        );
        await factory.createExchange(token.address);
        const Exchange = await ethers.getContractFactory("Exchange");
        const exchange = await Exchange.attach(exchangeAddress);

        return { owner, user, token, exchange };
    }

    describe("addLiquidity", async () => {
        describe("empty reserves", async () => {
            it("adds liquidity", async () => {
                const { exchange, token } = await loadFixture(deploy);
                await token.approve(exchange.address, toWei(200));
                const initial_liquidity = await exchange.callStatic.addLiquidity(toWei(100), toWei(200), DEADLINE, { value: toWei(100) });
                expect(initial_liquidity).to.equal(toWei(100));
                await exchange.addLiquidity(toWei(100), toWei(200), DEADLINE, { value: toWei(100) });
                expect(await getBalance(exchange.address)).to.equal(toWei(100));
                expect(await (token.balanceOf(exchange.address))).to.equal(toWei(200));
            });

            it("mints LP tokens", async () => {
                const { owner, exchange, token } = await loadFixture(deploy);
                await token.approve(exchange.address, toWei(200));
                await exchange.addLiquidity(toWei(100), toWei(200), DEADLINE, { value: toWei(100) });
                expect(await exchange.totalSupply()).to.eq(toWei(100));
                expect(await (exchange.balanceOf(owner.address))).to.equal(toWei(100));
            });

            it("does not allow zero amounts", async () => {
                const { exchange, token } = await loadFixture(deploy);
                await token.approve(exchange.address, 0);
                await expect(exchange.addLiquidity(0, 0, DEADLINE, { value: 0 })).to.be.revertedWith(
                    "need more than 1000000000 wei to create pool"
                );
                expect(await getBalance(exchange.address)).to.equal(0);
            });
        });

        describe("existing reserves", async () => {
            let exchange: Exchange
            let token: Token
            let owner: SignerWithAddress
            beforeEach(async () => {
                const fixture = await loadFixture(deploy);
                token = fixture.token
                exchange = fixture.exchange
                owner = fixture.owner
                await token.approve(exchange.address, toWei(400));
                await exchange.addLiquidity(toWei(100), toWei(200), DEADLINE, { value: toWei(100) });
            });

            it("preserves exchange rate", async () => {
                await exchange.addLiquidity(toWei(50), toWei(200), DEADLINE, { value: toWei(50) });
                expect(await getBalance(exchange.address)).to.equal(toWei(150));
                expect(await (token.balanceOf(exchange.address))).to.equal(toWei(300).add(BigNumber.from(1)));
            });

            it("mints LP tokens", async () => {
                await exchange.addLiquidity(toWei(50), toWei(200), DEADLINE, { value: toWei(50) });
                expect(await exchange.balanceOf(owner.address)).to.eq(toWei(150));
                expect(await exchange.totalSupply()).to.eq(toWei(150));
            });
        });
    });

    describe("removeLiquidity", async () => {
        let exchange: Exchange
        let token: Token
        let owner: SignerWithAddress
        beforeEach(async () => {
            const fixture = await loadFixture(deploy);
            token = fixture.token
            exchange = fixture.exchange
            owner = fixture.owner
            await token.approve(exchange.address, toWei(300));
            await exchange.addLiquidity(toWei(100), toWei(200), DEADLINE, { value: toWei(100) });
        });

        it("removes some liquidity", async () => {
            await exchange.removeLiquidity(toWei(25), toWei(25), toWei(50), DEADLINE);
            expect(await token.balanceOf(exchange.address)).to.equal(toWei(150));
            expect(await getBalance(exchange.address)).to.equal(toWei(75));

        });

        it("removes all liquidity", async () => {
            await exchange.removeLiquidity(toWei(100), toWei(100), toWei(200), DEADLINE);
            expect(await token.balanceOf(exchange.address)).to.equal(toWei(0));
            expect(await getBalance(exchange.address)).to.equal(toWei(0));
        });

        it("burns LP-tokens", async () => {
            await expect(() =>
                exchange.removeLiquidity(toWei(25))
            ).to.changeTokenBalance(exchange, owner, toWei(-25));

            expect(await exchange.totalSupply()).to.equal(toWei(75));
        });

        it("doesn't allow invalid amount", async () => {
            await expect(exchange.removeLiquidity(toWei(100.1))).to.be.revertedWith(
                "burn amount exceeds balance"
            );
        });
    });

    // describe("getTokenAmount", async () => {
    //     it("returns correct token amount", async () => {
    //         await token.approve(exchange.address, toWei(2000));
    //         await exchange.addLiquidity(toWei(2000), { value: toWei(1000) });

    //         let tokensOut = await exchange.getTokenAmount(toWei(1));
    //         expect(fromWei(tokensOut)).to.equal("1.978041738678708079");

    //         tokensOut = await exchange.getTokenAmount(toWei(100));
    //         expect(fromWei(tokensOut)).to.equal("180.1637852593266606");

    //         tokensOut = await exchange.getTokenAmount(toWei(1000));
    //         expect(fromWei(tokensOut)).to.equal("994.974874371859296482");
    //     });
    // });

    // describe("getEthAmount", async () => {
    //     it("returns correct ether amount", async () => {
    //         await token.approve(exchange.address, toWei(2000));
    //         await exchange.addLiquidity(toWei(2000), { value: toWei(1000) });

    //         let ethOut = await exchange.getEthAmount(toWei(2));
    //         expect(fromWei(ethOut)).to.equal("0.989020869339354039");

    //         ethOut = await exchange.getEthAmount(toWei(100));
    //         expect(fromWei(ethOut)).to.equal("47.16531681753215817");

    //         ethOut = await exchange.getEthAmount(toWei(2000));
    //         expect(fromWei(ethOut)).to.equal("497.487437185929648241");
    //     });
    // });

    // describe("ethToTokenTransfer", async () => {
    //     beforeEach(async () => {
    //         await token.approve(exchange.address, toWei(2000));
    //         await exchange.addLiquidity(toWei(2000), { value: toWei(1000) });
    //     });

    //     it("transfers at least min amount of tokens to recipient", async () => {
    //         const userBalanceBefore = await getBalance(user.address);

    //         await exchange
    //             .connect(user)
    //             .ethToTokenTransfer(toWei(1.97), user.address, { value: toWei(1) });

    //         const userBalanceAfter = await getBalance(user.address);
    //         expect(fromWei(userBalanceAfter.sub(userBalanceBefore))).to.equal(
    //             "-1.000000000062013"
    //         );

    //         const userTokenBalance = await token.balanceOf(user.address);
    //         expect(fromWei(userTokenBalance)).to.equal("1.978041738678708079");

    //         const exchangeEthBalance = await getBalance(exchange.address);
    //         expect(fromWei(exchangeEthBalance)).to.equal("1001.0");

    //         const exchangeTokenBalance = await token.balanceOf(exchange.address);
    //         expect(fromWei(exchangeTokenBalance)).to.equal("1998.021958261321291921");
    //     });
    // });

    // describe("ethToTokenSwap", async () => {
    //     beforeEach(async () => {
    //         await token.approve(exchange.address, toWei(2000));
    //         await exchange.addLiquidity(toWei(2000), { value: toWei(1000) });
    //     });

    //     it("transfers at least min amount of tokens", async () => {
    //         const userBalanceBefore = await getBalance(user.address);

    //         await exchange
    //             .connect(user)
    //             .ethToTokenSwap(toWei(1.97), { value: toWei(1) });

    //         const userBalanceAfter = await getBalance(user.address);
    //         expect(fromWei(userBalanceAfter.sub(userBalanceBefore))).to.equal(
    //             "-1.000000000061531"
    //         );

    //         const userTokenBalance = await token.balanceOf(user.address);
    //         expect(fromWei(userTokenBalance)).to.equal("1.978041738678708079");

    //         const exchangeEthBalance = await getBalance(exchange.address);
    //         expect(fromWei(exchangeEthBalance)).to.equal("1001.0");

    //         const exchangeTokenBalance = await token.balanceOf(exchange.address);
    //         expect(fromWei(exchangeTokenBalance)).to.equal("1998.021958261321291921");
    //     });

    //     it("affects exchange rate", async () => {
    //         let tokensOut = await exchange.getTokenAmount(toWei(10));
    //         expect(fromWei(tokensOut)).to.equal("19.605901574413308248");

    //         await exchange
    //             .connect(user)
    //             .ethToTokenSwap(toWei(9), { value: toWei(10) });

    //         tokensOut = await exchange.getTokenAmount(toWei(10));
    //         expect(fromWei(tokensOut)).to.equal("19.223356774598792281");
    //     });

    //     it("fails when output amount is less than min amount", async () => {
    //         await expect(
    //             exchange.connect(user).ethToTokenSwap(toWei(2), { value: toWei(1) })
    //         ).to.be.revertedWith("insufficient output amount");
    //     });

    //     it("allows zero swaps", async () => {
    //         await exchange
    //             .connect(user)
    //             .ethToTokenSwap(toWei(0), { value: toWei(0) });

    //         const userTokenBalance = await token.balanceOf(user.address);
    //         expect(fromWei(userTokenBalance)).to.equal("0.0");

    //         const exchangeEthBalance = await getBalance(exchange.address);
    //         expect(fromWei(exchangeEthBalance)).to.equal("1000.0");

    //         const exchangeTokenBalance = await token.balanceOf(exchange.address);
    //         expect(fromWei(exchangeTokenBalance)).to.equal("2000.0");
    //     });
    // });

    // describe("tokenToEthSwap", async () => {
    //     beforeEach(async () => {
    //         await token.transfer(user.address, toWei(22));
    //         await token.connect(user).approve(exchange.address, toWei(22));

    //         await token.approve(exchange.address, toWei(2000));
    //         await exchange.addLiquidity(toWei(2000), { value: toWei(1000) });
    //     });

    //     it("transfers at least min amount of tokens", async () => {
    //         const userBalanceBefore = await getBalance(user.address);
    //         const exchangeBalanceBefore = await getBalance(exchange.address);

    //         await exchange.connect(user).tokenToEthSwap(toWei(2), toWei(0.9));

    //         const userBalanceAfter = await getBalance(user.address);
    //         expect(fromWei(userBalanceAfter.sub(userBalanceBefore))).to.equal(
    //             "0.989020869279835039"
    //         );

    //         const userTokenBalance = await token.balanceOf(user.address);
    //         expect(fromWei(userTokenBalance)).to.equal("20.0");

    //         const exchangeBalanceAfter = await getBalance(exchange.address);
    //         expect(fromWei(exchangeBalanceAfter.sub(exchangeBalanceBefore))).to.equal(
    //             "-0.989020869339354039"
    //         );

    //         const exchangeTokenBalance = await token.balanceOf(exchange.address);
    //         expect(fromWei(exchangeTokenBalance)).to.equal("2002.0");
    //     });

    //     it("affects exchange rate", async () => {
    //         let ethOut = await exchange.getEthAmount(toWei(20));
    //         expect(fromWei(ethOut)).to.equal("9.802950787206654124");

    //         await exchange.connect(user).tokenToEthSwap(toWei(20), toWei(9));

    //         ethOut = await exchange.getEthAmount(toWei(20));
    //         expect(fromWei(ethOut)).to.equal("9.61167838729939614");
    //     });

    //     it("fails when output amount is less than min amount", async () => {
    //         await expect(
    //             exchange.connect(user).tokenToEthSwap(toWei(2), toWei(1.0))
    //         ).to.be.revertedWith("insufficient output amount");
    //     });

    //     it("allows zero swaps", async () => {
    //         const userBalanceBefore = await getBalance(user.address);
    //         await exchange.connect(user).tokenToEthSwap(toWei(0), toWei(0));

    //         const userBalanceAfter = await getBalance(user.address);
    //         expect(fromWei(userBalanceAfter.sub(userBalanceBefore))).to.equal(
    //             "-0.000000000044275"
    //         );

    //         const userTokenBalance = await token.balanceOf(user.address);
    //         expect(fromWei(userTokenBalance)).to.equal("22.0");

    //         const exchangeEthBalance = await getBalance(exchange.address);
    //         expect(fromWei(exchangeEthBalance)).to.equal("1000.0");

    //         const exchangeTokenBalance = await token.balanceOf(exchange.address);
    //         expect(fromWei(exchangeTokenBalance)).to.equal("2000.0");
    //     });
    // });

    // describe("tokenToTokenSwap", async () => {
    //     it("swaps token for token", async () => {
    //         const Factory = await ethers.getContractFactory("Factory");
    //         const Token = await ethers.getContractFactory("Token");

    //         const factory = await Factory.deploy();
    //         const token = await Token.deploy("TokenA", "AAA", toWei(1000000));
    //         const token2 = await Token.connect(user).deploy(
    //             "TokenB",
    //             "BBBB",
    //             toWei(1000000)
    //         );

    //         await factory.deployed();
    //         await token.deployed();
    //         await token2.deployed();

    //         const exchange = await createExchange(factory, token.address, owner);
    //         const exchange2 = await createExchange(factory, token2.address, user);

    //         await token.approve(exchange.address, toWei(2000));
    //         await exchange.addLiquidity(toWei(2000), { value: toWei(1000) });

    //         await token2.connect(user).approve(exchange2.address, toWei(1000));
    //         await exchange2
    //             .connect(user)
    //             .addLiquidity(toWei(1000), { value: toWei(1000) });

    //         expect(await token2.balanceOf(owner.address)).to.equal(0);

    //         await token.approve(exchange.address, toWei(10));
    //         await exchange.tokenToTokenSwap(toWei(10), toWei(4.8), token2.address);

    //         expect(fromWei(await token2.balanceOf(owner.address))).to.equal(
    //             "4.852698493489877956"
    //         );

    //         expect(await token.balanceOf(user.address)).to.equal(0);

    //         await token2.connect(user).approve(exchange2.address, toWei(10));
    //         await exchange2
    //             .connect(user)
    //             .tokenToTokenSwap(toWei(10), toWei(19.6), token.address);

    //         expect(fromWei(await token.balanceOf(user.address))).to.equal(
    //             "19.602080509528011079"
    //         );
    //     });
});