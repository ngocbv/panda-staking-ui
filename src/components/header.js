import * as React from 'react';
import Wallet from './wallet';
import '../styles/Header.css';
import logo from '../assets/imgs/logo_with_name.png';
import {
    WalletModalProvider,
    WalletDisconnectButton,
    WalletMultiButton
} from '@solana/wallet-adapter-react-ui';

export default function Header() {
    return (
        <div className="css-m7wkyr">
            <div className="css-1kj7ifn">
                <div className="css-1j66gwz">
                    <div className="chakra-stack css-1i0wgq1">
                        <div className="chakra-stack css-oft45e">
                            <a href="/">
                              <img width="200" src={logo} className="logo"></img>
                            </a>
                        </div>
                    </div>
                    <div className="chakra-stack css-1u6kme8">
                        <WalletModalProvider>
                            <WalletMultiButton />
                        </WalletModalProvider>
                    </div>
                    <div className="chakra-stack css-1buqvcx"></div>
                </div>
            </div>
        </div>
    );
}
