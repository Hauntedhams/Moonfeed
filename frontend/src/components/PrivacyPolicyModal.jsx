import React from 'react';
import { createPortal } from 'react-dom';
import './PrivacyPolicyModal.css';

const PrivacyPolicyModal = ({ isVisible, onClose }) => {
  if (!isVisible) return null;

  return createPortal(
    <div className="privacy-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="privacy-modal" onClick={(e) => e.stopPropagation()}>
        <div className="privacy-header">
          <h2>Privacy Policy</h2>
          <button className="privacy-close" onClick={onClose}>✕</button>
        </div>

        <div className="privacy-content">
          <p className="privacy-updated">Last updated: June 22, 2026</p>

          <section>
            <h3>1. Introduction</h3>
            <p>
              Welcome to Moonfeed ("we," "our," or "us"). This Privacy Policy explains how we handle information
              when you use the Moonfeed mobile app and website (collectively, the "Service"). We are committed
              to protecting your privacy and being transparent about our practices.
            </p>
          </section>

          <section>
            <h3>2. Information We Collect</h3>
            <p>Moonfeed collects minimal information to provide its service:</p>
            <ul>
              <li><strong>Wallet Addresses:</strong> If you connect a crypto wallet, we may store your public wallet address locally on your device. We never have access to your private keys or seed phrase.</li>
              <li><strong>Usage Data:</strong> We may collect anonymous usage analytics such as which features are used, app performance data, and crash reports to improve the app.</li>
              <li><strong>Local Storage:</strong> We use your device's local storage to save your preferences, favorites, and settings. This data stays on your device.</li>
              <li><strong>Referral Data:</strong> If you use a referral link, we track referral codes to attribute sign-ups. No personal information is tied to these codes.</li>
            </ul>
            <p>We do <strong>not</strong> collect your name, email address, phone number, or any other personally identifying information unless you voluntarily provide it (e.g., joining our Discord or Telegram).</p>
          </section>

          <section>
            <h3>3. How We Use Information</h3>
            <ul>
              <li>To provide and improve the Moonfeed Service</li>
              <li>To display personalized content such as your saved favorites</li>
              <li>To diagnose technical issues and improve app performance</li>
              <li>To process referral attributions</li>
            </ul>
          </section>

          <section>
            <h3>4. Third-Party Services</h3>
            <p>Moonfeed integrates with the following third-party services. Their privacy policies apply when you interact with them:</p>
            <ul>
              <li><strong>Jupiter:</strong> Handles all swap transactions. Trades are executed directly between your wallet and the blockchain. We never hold your funds.</li>
              <li><strong>DexScreener:</strong> Provides market data and price charts.</li>
              <li><strong>Pump.fun:</strong> Provides newly launched token data.</li>
              <li><strong>Rugcheck:</strong> Provides token safety analysis.</li>
              <li><strong>Solana RPC:</strong> Provides on-chain blockchain data.</li>
            </ul>
          </section>

          <section>
            <h3>5. Data Sharing</h3>
            <p>
              We do not sell, trade, or rent your personal information to third parties. We do not share
              any personally identifiable information with advertisers or marketing companies.
            </p>
          </section>

          <section>
            <h3>6. Data Security</h3>
            <p>
              We take reasonable measures to protect the information we hold. However, no method of
              transmission over the internet is 100% secure. We encourage you to protect your own
              wallet credentials and never share your private keys or seed phrases with anyone,
              including us.
            </p>
          </section>

          <section>
            <h3>7. Children's Privacy</h3>
            <p>
              Moonfeed is not intended for users under the age of 18. We do not knowingly collect
              information from anyone under 18. If you believe a child has provided us with personal
              information, please contact us.
            </p>
          </section>

          <section>
            <h3>8. Financial Disclaimer</h3>
            <p>
              Moonfeed is an informational tool only. Nothing on the platform constitutes financial
              advice. Meme coins and cryptocurrencies are highly speculative and volatile assets.
              Only invest what you can afford to lose. Always do your own research (DYOR).
            </p>
          </section>

          <section>
            <h3>9. Changes to This Policy</h3>
            <p>
              We may update this Privacy Policy from time to time. We will notify users of significant
              changes by updating the "Last updated" date above. Continued use of the Service after
              changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h3>10. Contact Us</h3>
            <p>
              If you have questions about this Privacy Policy, you can reach us at:
            </p>
            <ul>
              <li>Discord: <a href="https://discord.gg/pdSpJAz5" target="_blank" rel="noopener noreferrer">discord.gg/pdSpJAz5</a></li>
              <li>Twitter/X: <a href="https://x.com/moonfeedapp" target="_blank" rel="noopener noreferrer">@moonfeedapp</a></li>
            </ul>
          </section>
        </div>

        <div className="privacy-footer">
          <button className="privacy-close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PrivacyPolicyModal;
