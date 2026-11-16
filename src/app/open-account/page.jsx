import Image from 'next/image';
import Link from 'next/link';
import MarketNavigation from '../../components/market-navigation.jsx';
import { SoundControl } from '../../components/monitor/monitor-provider.jsx';
import EquityPortfolioDesk from '../../components/equity/equity-portfolio-desk.jsx';
import styles from './open-account.module.css';

export const metadata = {
  title: 'เปิดพอร์ต 3 โบรกเกอร์พันธมิตร รับสิทธิ์ VIP & Telegram ฟรีตลอดชีพ | Nugaom AI Pick',
  description: 'เปิดบัญชีซื้อขายหุ้นไทย DR และ TFEX กับ บล.พาย (003), บล.ทรีนีตี้ (022) หรือ บล.เอเอสแอล (050) รับสิทธิ์เข้ากลุ่ม Telegram VIP สัญญาณเรียลไทม์ และระบบ Settrade Open API ฟรีตลอดชีพ',
};

export default function OpenAccountPage() {
  return (
    <div className={styles.openAccountPage}>
      {/* Top Navbar */}
      <header className={styles.topBar}>
        <Link href="/" className={styles.brandGroup}>
          <Image
            src="/nugaom-mascot.png"
            width={40}
            height={40}
            alt="Nugaom AI Mascot"
            className={styles.brandLogo}
          />
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>Nugaom AI Pick</span>
            <span className={styles.brandSub}>Official Brokerage Partner Hub</span>
          </div>
        </Link>

        <MarketNavigation current="open-account" />

        <div className={styles.topActions}>
          <SoundControl />
          <Link href="/thai" className={styles.backBtn}>
            ← กลับหน้าหุ้นไทย
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.contentWrapper}>
        <section className={styles.heroSection}>
          <div className={styles.heroBadge}>
            👑 สิทธิประโยชน์พิเศษสำหรับสมาชิก Nugaom
          </div>
          <h1 className={styles.heroHeading}>
            เปิดพอร์ตลงทุน 3 โบรกเกอร์พันธมิตร<br />
            รับสิทธิ์ VIP &amp; Telegram สัญญาณฟรีตลอดชีพ
          </h1>
          <p className={styles.heroSubtitle}>
            เลือกเปิดบัญชีใหม่หรือแจ้งเลขพอร์ตเดิมกับ <strong>บล.พาย (003)</strong>, <strong>บล.ทรีนีตี้ (022)</strong> หรือ <strong>บล.เอเอสแอล (050)</strong> เพื่อปลดล็อกระบบสแกนหุ้น AI, ตรวจแนวรับแนวต้าน, การแจ้งเตือนสัญญาณผ่าน Telegram และระบบ Settrade Open API แบบ Zero-Custody ไร้ค่าบริการรายเดือน
          </p>

          <div className={styles.benefitsGrid}>
            <div className={styles.benefitCard}>
              <span className={styles.benefitIcon}>🇹🇭</span>
              <h3 className={styles.benefitTitle}>หุ้นไทย Stage 2 (SET100)</h3>
              <p className={styles.benefitText}>
                โพยหุ้นเด่นเช้า 09:30 และการบ้านเย็น 17:30 (ไม่ซ้ำรอบเช้า) พร้อมกรอบความเสี่ยง 2R คำนวณขนาดไม้ก่อนเข้าซื้อ
              </p>
            </div>

            <div className={styles.benefitCard}>
              <span className={styles.benefitIcon}>🌐</span>
              <h3 className={styles.benefitTitle}>DR หุ้นนอกระดับโลก (DR80)</h3>
              <p className={styles.benefitText}>
                เกาะกระแสเทคโนโลยีโลก (NVDA, AAPL, MSFT, TSLA) ผ่านกระดานหุ้นไทย คำนวณราคายุติธรรมและ Indicative Bridge
              </p>
            </div>

            <div className={styles.benefitCard}>
              <span className={styles.benefitIcon}>📈</span>
              <h3 className={styles.benefitTitle}>TFEX Index &amp; Block Trade</h3>
              <p className={styles.benefitText}>
                อ่านสัญญา SET50 และโลหะมีค่า Gold/Silver วางแผน Risk/Reward ชัดเจน คุม Drawdown ไม่ให้เกินงบ
              </p>
            </div>

            <div className={styles.benefitCard}>
              <span className={styles.benefitIcon}>✈️</span>
              <h3 className={styles.benefitTitle}>Telegram VIP Real-Time</h3>
              <p className={styles.benefitText}>
                รับลิงก์เข้ากลุ่มแจ้งเตือนทันทีที่ส่งคำขอ สัญญาณตรงเข้ามือถือ 24 ชม. ไม่พลาดทุกจังหวะเบรกเอาท์สำคัญ
              </p>
            </div>
          </div>
        </section>

        {/* Portfolio Desk Suite */}
        <section className={styles.deskContainer}>
          <EquityPortfolioDesk />
        </section>

        {/* FAQ Section */}
        <section className={styles.faqSection}>
          <h2 className={styles.faqHeading}>คำถามที่พบบ่อย (FAQ)</h2>
          <div className={styles.faqGrid}>
            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>❓ มีพอร์ตกับ บล.พาย, บล.ทรีนีตี้ หรือ บล.เอเอสแอล อยู่แล้ว ต้องทำอย่างไร?</h3>
              <p className={styles.faqAnswer}>
                ท่านสามารถเลือกแท็บ <strong>&quot;มีพอร์ตเดิมแล้ว แจ้งเลขพอร์ตยืนยันสิทธิ์ VIP&quot;</strong> ในแบบฟอร์มด้านบน แล้วกรอกเลขที่บัญชีซื้อขายได้ทันที เจ้าหน้าที่จะทำการผูกสิทธิ์ VIP ให้ท่านใช้งานระบบได้ทันทีโดยไม่ต้องเปิดพอร์ตใหม่
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>🔒 ปลอดภัยหรือไม่? Nugaom เข้าถึงเงินหรือสั่งซื้อขายแทนได้ไหม?</h3>
              <p className={styles.faqAnswer}>
                <strong>ปลอดภัย 100% ด้วยหลักการ Zero-Custody</strong> ระบบ Nugaom AI ไม่เก็บเงิน ไม่ถือครองสินทรัพย์ และไม่มีอำนาจถอนเงินของท่าน บัญชีเงินและการทำธุรกรรมทั้งหมดอยู่ภายใต้การกำกับดูแลของ ก.ล.ต. และระบบคอมพิวเตอร์ของโบรกเกอร์พันธมิตรโดยตรง
              </p>
            </div>

            <div className={styles.faqItem}>
              <h3 className={styles.faqQuestion}>⚡ ส่งข้อมูลแล้วจะได้เข้ากลุ่ม Telegram VIP เมื่อไร?</h3>
              <p className={styles.faqAnswer}>
                ระบบจะสร้าง <strong>One-time Invite Link เฉพาะตัวของท่านให้ทันทีบนหน้าจอหลังกดส่งข้อมูล</strong> ท่านสามารถกดเข้าร่วมกลุ่มและทดลองใช้งานสิทธิ์ VIP 14 วันได้ทันทีระหว่างที่เจ้าหน้าที่การตลาดตรวจสอบและเปิดสิทธิ์ถาวรให้ท่าน
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

