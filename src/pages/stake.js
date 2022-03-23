import React, { useState, useEffect } from 'react';

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Countdown from "react-countdown";

import { Connection, PublicKey } from '@solana/web3.js';
import { Program, Provider, web3, BN } from '@project-serum/anchor';
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";

import '../styles/Stake.css';
import pandaIcon from '../assets/imgs/logo.png';
import idl from '../json/idl.json';

import {
    useWallet,
    useConnection
} from '@solana/wallet-adapter-react';
require('@solana/wallet-adapter-react-ui/styles.css');

const { SystemProgram, Keypair, SYSVAR_CLOCK_PUBKEY } = web3;
const programID = new PublicKey(idl.metadata.address);
const poolPubkey = new PublicKey(process.env.REACT_APP_POOL)
const opts = {
    preflightCommitment: "processed"
}
export default function Stake() {
    const [selectedSTab, setSelectedSTab] = useState(0);
    const [selectedUSTab, setSelectedUSTab] = useState(0);
    const [selectedTab, setSelectedTab] = useState(0);
    const [pandaStakeAmount, setPandaStakeAmount] = useState('');
    const [pandaUnstakeAmount, setPandaUnstakeAmount] = useState('');
    const [totalStackedPHANT, setTotalStackedPHANT] = useState(0.0);
    const [totalUnstakedPHANT, setTotalUnstakedPHANT] = useState(0.0);
    const [earn, setEarn] = useState(0.0);
    const [balance, setBalance] = useState(0.0);
    const [stakedAmount, setStakedAmount] = useState(0.0);
    const [stakeTimestamp, setStakeTimestamp] = useState(0);

    const { connection } = useConnection();

    const wallet = useWallet();
    async function getProvider() {
        const provider = new Provider(
            connection, wallet, opts.preflightCommitment,
        );
        return provider;
    }

    async function stake() {
        let amount = parseFloat(pandaStakeAmount);
        if (isNaN(amount) || amount === 0) {
            toast.error("Amount is zero.", { theme: "dark" });
            return;
        }

        const maxAmount = await getTokenBalance(new PublicKey(process.env.REACT_APP_PHANT_STAKE_TOKEN_ID));
        if (amount > maxAmount) {
            toast.error("Not enough token amount.", { theme: "dark" });
            return;
        }

        const provider = await getProvider()

        const program = new Program(idl, programID, provider);
        let poolObject = await program.account.pool.fetch(poolPubkey);

        const [
            _poolSigner,
            _nonce,
        ] = await PublicKey.findProgramAddress(
            [poolPubkey.toBuffer()],
            programID
        );
        let poolSigner = _poolSigner;

        const [
            _userPubkey, _userNonce,
        ] = await PublicKey.findProgramAddress(
            [wallet.publicKey.toBuffer(), poolPubkey.toBuffer()],
            programID
        );

        try {
            await program.account.user.fetch(_userPubkey);
        } catch (e) {
            if (e.message == 'Account does not exist ' + _userPubkey.toBase58()) {
                await createStakeAccount();
            }
        }

        try {
            const stakingMintObject = new Token(
                provider.connection,
                new PublicKey(process.env.REACT_APP_PHANT_STAKE_TOKEN_ID),
                TOKEN_PROGRAM_ID,
                provider.wallet.payer);
            const stakingAccountInfo = await stakingMintObject.getOrCreateAssociatedAccountInfo(wallet.publicKey);
            const stakingPubkey = stakingAccountInfo.address;

            await program.rpc.stake(
                new BN(amount * web3.LAMPORTS_PER_SOL),
                {
                    accounts: {
                        // Stake instance.
                        pool: poolPubkey,
                        stakingVault: poolObject.stakingVault,
                        // User.
                        user: _userPubkey,
                        owner: wallet.publicKey,
                        stakeFromAccount: stakingPubkey,
                        // Program signers.
                        poolSigner,
                        // Misc.
                        clock: SYSVAR_CLOCK_PUBKEY,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    },
                }
            );
            toast.success("Stake PANDA successfully!", { theme: "dark" });
            setPandaStakeAmount(0);
            await refreshPage();
        } catch (err) {
            console.log("Transaction error: ", err);
            toast.error("Transaction error, try again later!", { theme: "dark" });
        }
    }

    async function unstake() {

        let amount = parseFloat(pandaUnstakeAmount);
        if (isNaN(amount) || amount === 0) {
            toast.error("Amount is zero", { theme: "dark" });
            return;
        }

        const maxAmount = await getStakedBalance();
        if (amount > maxAmount) {
            toast.error("Not enough token amount.", { theme: "dark" });
            return;
        }

        const provider = await getProvider()

        const program = new Program(idl, programID, provider);
        let poolObject = await program.account.pool.fetch(poolPubkey);

        const [
            _poolSigner,
            _nonce,
        ] = await PublicKey.findProgramAddress(
            [poolPubkey.toBuffer()],
            programID
        );
        let poolSigner = _poolSigner;

        const [
            _userPubkey, _userNonce,
        ] = await PublicKey.findProgramAddress(
            [wallet.publicKey.toBuffer(), poolPubkey.toBuffer()],
            programID
        );
        try {

            const stakingMintObject = new Token(
                provider.connection,
                new PublicKey(process.env.REACT_APP_PHANT_STAKE_TOKEN_ID),
                TOKEN_PROGRAM_ID,
                provider.wallet.payer);
            const stakingAccountInfo = await stakingMintObject.getOrCreateAssociatedAccountInfo(wallet.publicKey);
            const stakingPubkey = stakingAccountInfo.address;

            await program.rpc.unstake(
                new BN(amount * web3.LAMPORTS_PER_SOL),
                {
                    accounts: {
                        // Stake instance.
                        pool: poolPubkey,
                        stakingVault: poolObject.stakingVault,
                        // User.
                        user: _userPubkey,
                        owner: wallet.publicKey,
                        stakeFromAccount: stakingPubkey,
                        // Program signers.
                        poolSigner,
                        // Misc.
                        clock: SYSVAR_CLOCK_PUBKEY,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    },
                });
            toast.success("Unstake PANDA successfully!", { theme: "dark" });
            await refreshPage();
            setPandaUnstakeAmount(0);
        } catch (err) {
            console.log("Transaction error: ", err);
            toast.error("Transaction error, try again later!", { theme: "dark" });
        }
    }

    async function claim() {

        const provider = await getProvider()

        const program = new Program(idl, programID, provider);

        let poolObject = await program.account.pool.fetch(poolPubkey);

        const stakingMintObject = new Token(
            provider.connection,
            new PublicKey(process.env.REACT_APP_PHANT_STAKE_TOKEN_ID),
            TOKEN_PROGRAM_ID,
            provider.wallet.payer);
        const stakingAccountInfo = await stakingMintObject.getOrCreateAssociatedAccountInfo(wallet.publicKey);
        const stakingPubkey = stakingAccountInfo.address;

        const [
            _poolSigner,
            _nonce,
        ] = await PublicKey.findProgramAddress(
            [poolPubkey.toBuffer()],
            programID
        );
        let poolSigner = _poolSigner;

        const [
            userPubkey, _userNonce,
        ] = await PublicKey.findProgramAddress(
            [provider.wallet.publicKey.toBuffer(), poolPubkey.toBuffer()],
            programID
        );

        try {

            await program.rpc.claim({
                accounts: {
                    // Stake instance.
                    pool: poolPubkey,
                    stakingVault: poolObject.stakingVault,
                    rewardAVault: poolObject.rewardAVault,
                    // User.
                    user: userPubkey,
                    owner: provider.wallet.publicKey,
                    rewardAAccount: stakingPubkey,
                    rewardBAccount: stakingPubkey,
                    // Program signers.
                    poolSigner,
                    // Misc.
                    clock: web3.SYSVAR_CLOCK_PUBKEY,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
            });
            toast.success("Claim PANDA successfully!", { theme: "dark" });
            setEarn(0.0);
        } catch (e) {
          toast.error("Transaction error, try again later!", { theme: "dark" });
        }

        return await getTokenBalance(new PublicKey(process.env.REACT_APP_PHANT_STAKE_TOKEN_ID));
    }

    async function fund(amountA) {
        const provider = await getProvider()

        const program = new Program(idl, programID, provider);

        let pubkeyToUse = poolPubkey;
        let poolObject = await program.account.pool.fetch(pubkeyToUse);

        const stakingMintObject = new Token(
            provider.connection,
            new PublicKey(process.env.REACT_APP_PHANT_STAKE_TOKEN_ID),
            TOKEN_PROGRAM_ID,
            provider.wallet.payer);
        const stakingAccountInfo = await stakingMintObject.getOrCreateAssociatedAccountInfo(wallet.publicKey);
        const stakingPubkey = stakingAccountInfo.address;

        const [
            _poolSigner,
            _nonce,
        ] = await PublicKey.findProgramAddress(
            [pubkeyToUse.toBuffer()],
            programID
        );
        let poolSigner = _poolSigner;

        await program.rpc.fund(
            new BN(amountA * web3.LAMPORTS_PER_SOL),
            new BN(0),
            {
                accounts: {
                    // Stake instance.
                    pool: pubkeyToUse,
                    stakingVault: poolObject.stakingVault,
                    rewardAVault: poolObject.rewardAVault,
                    rewardBVault: poolObject.rewardBVault,
                    funder: provider.wallet.publicKey,
                    fromA: stakingPubkey,
                    fromB: stakingPubkey,
                    // Program signers.
                    poolSigner,
                    // Misc.
                    clock: web3.SYSVAR_CLOCK_PUBKEY,
                    tokenProgram: TOKEN_PROGRAM_ID,
                },
            });
    }

    async function getTokenBalance(pubkey) {
        if (!wallet.publicKey) {
            return 0;
        }

        const provider = await getProvider();
        const tokens = await provider.connection.getTokenAccountsByOwner(wallet.publicKey, { mint: pubkey });
        if (tokens.value.length == 0) {
            return 0;
        }
        const token = tokens.value.pop();
        const val = (await provider.connection.getTokenAccountBalance(token.pubkey)).value;
        const balance = val.uiAmount;

        return parseFloat(balance.toFixed(6));
    }

    async function getTotalStakedBalance(pubkey) {
        const provider = await getProvider();

        const [
            _poolSigner,
            _nonce,
        ] = await PublicKey.findProgramAddress(
            [poolPubkey.toBuffer()],
            programID
        );
        let poolSigner = _poolSigner;

        const tokens = await provider.connection.getTokenAccountsByOwner(
            poolSigner, { mint: pubkey });

        if (tokens.value.length == 0) {
            return 0;
        }
        const token = tokens.value.pop();
        const balance = (await provider.connection.getTokenAccountBalance(token.pubkey)).value.uiAmount.toFixed(6);
        return parseFloat(balance);
    }

    async function getTotalUnstakedBalance(pubkey) {

        const provider = await getProvider();
        const tokens = await provider.connection.getTokenAccountsByOwner(
            new PublicKey(process.env.REACT_APP_FUNDER), { mint: pubkey });

        if (tokens.value.length == 0) {
            return 0;
        }
        const token = tokens.value.pop();
        const balance = (await provider.connection.getTokenAccountBalance(token.pubkey)).value.uiAmount.toFixed(6);

        return parseFloat(balance);
    }

    async function getStakedBalance() {

        const provider = await getProvider()

        const program = new Program(idl, programID, provider);

        const [
            _userPubkey, _userNonce,
        ] = await PublicKey.findProgramAddress(
            [wallet.publicKey.toBuffer(), poolPubkey.toBuffer()],
            programID
        );

        try {
            const accountData = await program.account.user.fetch(_userPubkey);
            setStakeTimestamp(accountData.stakeTime.toNumber() * 1000);
            return (accountData.balanceStaked.toNumber() / web3.LAMPORTS_PER_SOL).toFixed(6);
        } catch (e) {
            console.log(e.message)
            return 0;
        }

    }

    async function setMaxValue() {
        setPandaStakeAmount(await getTokenBalance(new PublicKey(process.env.REACT_APP_PHANT_STAKE_TOKEN_ID)));
    }

    async function setUnstakeMaxValue() {
        setPandaUnstakeAmount(await getStakedBalance());
    }

    async function createStakeAccount() {
        const provider = await getProvider();
        const program = new Program(idl, programID, provider);

        const [
            _userPubkey, _userNonce,
        ] = await PublicKey.findProgramAddress(
            [provider.wallet.publicKey.toBuffer(), poolPubkey.toBuffer()],
            program.programId
        );

        try {
            await program.rpc.createUser(_userNonce, {
                accounts: {
                    pool: poolPubkey,
                    user: _userPubkey,
                    owner: provider.wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                },
            });
        } catch (e) {
            if (e.message == 'failed to send transaction: Transaction simulation failed: Attempt to debit an account but found no record of a prior credit.') {
                toast.error("You need to charge at least 0.00001 sol", { theme: "dark" });
            }
        }
    }

    async function getEarned() {
        const provider = await getProvider()
        const program = new Program(idl, programID, provider);

        if (wallet.publicKey === null) {
            // setTimeout(() => {
            //     getEarned();
            // }, 1000)
            return;
        }

        const [
            _userPubkey, _userNonce,
        ] = await PublicKey.findProgramAddress(
            [wallet.publicKey.toBuffer(), poolPubkey.toBuffer()],
            programID
        );

        setBalance(await getTokenBalance(new PublicKey(process.env.REACT_APP_PHANT_STAKE_TOKEN_ID)));
        setStakedAmount(await getStakedBalance());
        try {
            const accountData = await program.account.user.fetch(_userPubkey);
            let lastUpdated = accountData.lastUpdateTime.toNumber();
            let now = parseInt((new Date()).getTime() / 1000);
            let diff = now - lastUpdated;

            let val = (accountData.rewardBRate.toNumber() / web3.LAMPORTS_PER_SOL) * diff;
            val += accountData.rewardB.toNumber() / web3.LAMPORTS_PER_SOL;
            setEarn(val.toFixed(6));
        } catch (e) {

        }
    }

    const refreshPage = async () => {

        // const balance = await getTotalStakedBalance(new PublicKey(process.env.REACT_APP_PHANT_STAKE_TOKEN_ID));
        // console.log("balance", balance)
        // setTotalStackedPHANT(balance);

        // const ubalance = await getTotalUnstakedBalance(new PublicKey(process.env.REACT_APP_PHANT_STAKE_TOKEN_ID));
        // setTotalUnstakedPHANT(ubalance);

        await getEarned()

        return () => {

        }
    }

    useEffect(refreshPage, [wallet])

    return (
        <div>
            <ToastContainer />
            <h1 style={{textAlign: "center"}}>Staking Pool V1</h1>
            <div className="css-3c6eg3">
                <div className="css-1m984bj">
                    <div className="css-1ipn2vc">
                        <div className="css-1irvasc">
                            <div className="chakra-stack css-keb7u0">
                                <div className="chakra-stat css-1mbo1ls">
                                    <dl>
                                        <dt className="chakra-stat__label css-1ovag0s">Wallet (balance: {balance})</dt>
                                        <div className="chakra-stack css-1y05o36">
                                            <div>
                                                <img width="35" height="35" sizes="(min-width: 35px) 35px, 100vw" decoding="async" src={pandaIcon} style={{ maxWidth: 45 }} />
                                            </div>
                                            <dd className="chakra-stat__number css-1u32qky" style={{marginLeft: 10}}>
                                                <div className="chakra-stack css-qf81zg">
                                                    <p>{` PANDA`}</p>
                                                </div>
                                            </dd>
                                            <div style={{ marginLeft: 20 }}>
                                              <span>{`Your reward: `}</span>
                                              <span style={{fontWeight: "bold"}}>{earn}</span>
                                              <span>{` PANDA`}</span>
                                            </div>
                                            <div style={{ marginLeft: 10, padding: 5, borderWidth: 1, borderStyle: 'solid', borderRadius: 5 }}>
                                                <button onClick={(e) => claim()}>Claim now</button>
                                            </div>
                                        </div>
                                    </dl>
                                </div>
                            </div>
                        </div>
                        {false && (
                        <div className="css-17zb26e">
                            <div className="chakra-stack css-s7z0if">
                                <div className="chakra-stat css-1iodnbg">
                                    <dl>
                                        <dt className="chakra-stat__label css-1cvxnhk">Total staked</dt>
                                        <div className="chakra-stack css-10iho9r">
                                            <div className="css-89leb0">
                                                <dd className="chakra-stat__number css-1loxz6u">
                                                    <div className="chakra-stack css-8320s1">
                                                        <div className="css-yslke8">{totalStackedPHANT}</div>
                                                        <p>PANDA</p>
                                                    </div>
                                                </dd>
                                                {/*<dd className="chakra-stat__help-text css-o0h8lz">≈ $1,477,119,462</dd>*/}
                                            </div>
                                        </div>
                                    </dl>
                                </div>
                                <hr aria-orientation="vertical" className="chakra-divider css-6cji22"></hr>
                                <div className="chakra-stat css-1sps1hr">
                                    <dl>
                                        <dt className="chakra-stat__label css-1cvxnhk">Unstake liquidity</dt>
                                        <div className="chakra-stack css-10iho9r">
                                            <div className="css-1azbirj">
                                                <dd className="chakra-stat__number css-1loxz6u">
                                                    <div className="chakra-stack css-8320s1">
                                                        <div className="css-yslke8">{totalUnstakedPHANT}</div>
                                                        <p>PANDA</p>
                                                    </div>
                                                </dd>
                                                {/*<dd className="chakra-stat__help-text css-o0h8lz">≈ $110,578,305</dd>*/}
                                            </div>
                                        </div>
                                    </dl>
                                </div>
                            </div>
                          </div>
                        )}
                    </div>
                </div>
                <div style={{ outline: 'none' }}>
                    <div className="chakra-tabs css-8dg5nr">
                        <div role="tablist" aria-orientation="horizontal" className="chakra-tabs__tablist css-1wl24ee">
                            <button
                                aria-selected={selectedTab == 0}
                                className="chakra-tabs__tab css-o9kd5c"
                                onClick={(e) => setSelectedTab(0)}
                            >Stake</button>
                            <button
                                aria-selected={selectedTab == 1}
                                className="chakra-tabs__tab css-o9kd5c"
                                onClick={(e) => setSelectedTab(1)}
                            >Unstake</button>
                        </div>
                        <div className="chakra-tabs__tab-panels css-1lglnv0">
                            <div className="chakra-tabs__tab-panel css-a5mhaz" hidden={selectedTab !== 0}>
                                <div className="chakra-stack css-1gl4x3w">
                                    <div className="chakra-stack css-100uh2e">
                                        <div className="css-1kw2fa0">
                                            <div className="chakra-tabs css-13o7eu2">
                                                <div style={{paddingTop: 10}}>
                                                  {`Your staked amount: ${stakedAmount} PANDA`}
                                                </div>
                                                <div className="chakra-tabs__tab-panels css-8atqhb">
                                                    <div className="chakra-tabs__tab-panel css-n8lhb7" hidden={selectedSTab !== 0}>
                                                        <div className="css-0">
                                                            <div className="css-s7o7ur">
                                                                <div className="css-gg4vpm">
                                                                    <div className="chakra-stack css-1041bnj">
                                                                        <div data-gatsby-image-wrapper="" className="gatsby-image-wrapper gatsby-image-wrapper-constrained">
                                                                            <div style={{ maxWidth: 20, display: 'block', width: 20, height: 20 }}>
                                                                                <picture>
                                                                                    <source type="image/svg" src={pandaIcon} sizes="(min-width: 20px) 20px, 100vw" />
                                                                                    <img width="20" height="20" sizes="(min-width: 20px) 20px, 100vw" decoding="async" src={pandaIcon} alt="mSOL" style={{ objectFit: 'cover', opacity: 1, maxWidth: 20 }} />
                                                                                </picture>
                                                                            </div>
                                                                        </div>
                                                                        <p className="chakra-text css-2ygcmq">PANDA</p>
                                                                    </div>
                                                                    <div className="chakra-numberinput css-17wygfg">
                                                                        <input className="phantInput" placeholder="0.0" type="text" value={pandaStakeAmount} onChange={e => setPandaStakeAmount(e.target.value)} />
                                                                        <div className="chakra-input__right-element css-60m06v">
                                                                            <button
                                                                                type="button"
                                                                                className="chakra-button css-4eg0af"
                                                                                onClick={e => setMaxValue()}
                                                                            >MAX</button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <button type="button" className="chakra-button css-zu7fla" onClick={() => stake()}>
                                                                Stake
                                                                <span className="chakra-button__icon css-1hzyiq5">
                                                                    <svg viewBox="0 0 24 24" focusable="false" className="chakra-icon css-onkibi" aria-hidden="true">
                                                                        <path fill="currentColor" d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"></path>
                                                                    </svg>
                                                                </span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="chakra-tabs__tab-panel css-n8lhb7" hidden={selectedSTab !== 1}>
                                                        <p>Your stake accounts will be shown here.</p>
                                                        <p>You don't have any valid stake accounts.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="chakra-tabs__tab-panel css-a5mhaz" hidden={selectedTab !== 1}>
                                <div className="chakra-stack css-1gl4x3w">
                                    <div className="chakra-stack css-100uh2e">
                                        <div className="css-1kw2fa0">
                                            <div className="chakra-tabs css-13o7eu2">
                                                <div style={{paddingTop: 10}}>
                                                  {`Your staked amount: ${stakedAmount} PANDA`}
                                                </div>
                                                <div className="chakra-tabs__tab-panels css-8atqhb">
                                                    <div className="chakra-tabs__tab-panel css-n8lhb7" hidden={selectedUSTab !== 0}>
                                                        <div className="css-0">
                                                            <div className="css-s7o7ur">
                                                                <div className="css-gg4vpm">
                                                                    <div className="chakra-stack css-1041bnj">
                                                                        <div data-gatsby-image-wrapper="" className="gatsby-image-wrapper gatsby-image-wrapper-constrained">
                                                                            <div style={{ maxWidth: 20, display: 'block', width: 20, height: 20 }}>
                                                                                <picture>
                                                                                    <source type="image/svg" src={pandaIcon} sizes="(min-width: 20px) 20px, 100vw" />
                                                                                    <img width="20" height="20" sizes="(min-width: 20px) 20px, 100vw" decoding="async" src={pandaIcon} alt="mSOL" style={{ objectFit: 'cover', opacity: 1, maxWidth: 20 }} />
                                                                                </picture>
                                                                            </div>
                                                                        </div>
                                                                        <p className="chakra-text css-2ygcmq">PANDA</p>
                                                                    </div>
                                                                    <div className="chakra-numberinput css-17wygfg">
                                                                        <input className="phantInput" placeholder="0.0" type="text" value={pandaUnstakeAmount} onChange={e => setPandaUnstakeAmount(e.target.value)} />
                                                                        <div className="chakra-input__right-element css-60m06v">
                                                                            <button
                                                                                type="button"
                                                                                className="chakra-button css-4eg0af"
                                                                                onClick={e => setUnstakeMaxValue()}
                                                                            >MAX</button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div>
                                                              <span>You have to wait</span>
                                                              <span>{" "}</span>
                                                              <span style={{fontWeight: "bold"}}>
                                                                <Countdown date={stakeTimestamp + 30 * 24 * 3600 * 1000} />
                                                              </span>
                                                              <span>{" "}</span>
                                                              <span>to unstake</span>
                                                            </div>
                                                            <button disabled={stakeTimestamp + 30 * 24 * 3600 * 1000 > Date.now()} type="button" className="chakra-button css-zu7fla" onClick={() => unstake()}>
                                                                Unstake now
                                                                <span className="chakra-button__icon css-1hzyiq5">
                                                                    <svg viewBox="0 0 24 24" focusable="false" className="chakra-icon css-onkibi" aria-hidden="true">
                                                                        <path fill="currentColor" d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"></path>
                                                                    </svg>
                                                                </span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}
