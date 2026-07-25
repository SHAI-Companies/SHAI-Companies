const Arrow = () => <span aria-hidden="true">↗</span>;

const services = [
  {
    number: "01",
    label: "Websites",
    title: "A website that sells while you sleep.",
    text: "Custom, fast-loading sites built to turn lookers into bookers, browsers into buyers, and interest into action.",
    details: ["Mobile-first custom design", "Ordering, booking and gift cards", "Hosting, SSL, SEO and analytics"],
  },
  {
    number: "02",
    label: "Social",
    title: "A feed that works harder than you do.",
    text: "Strategy, design, writing and posting that keeps your business active, recognizable and worth following.",
    details: ["Content calendar and strategy", "Posts, reels and stories", "Scheduling and monthly reporting"],
  },
  {
    number: "03",
    label: "AI",
    title: "AI under the hood. Polish on the surface.",
    text: "A sharper production engine behind the work, giving small businesses more speed, better output and a sensible price.",
    details: ["AI-assisted copy and creative", "Photo and video enhancement", "Smart automation and chat"],
  },
];

const steps = [
  ["01", "Discover", "One focused conversation about your brand, goals and customers. You get a clear plan and fixed quote."],
  ["02", "Design", "We build fast, then share a live working version. You react, request and refine before launch."],
  ["03", "Launch", "Domain, hosting, SSL, analytics and SEO are handled, tested on real devices and pushed live."],
  ["04", "Grow", "Optional ongoing social, fresh content, updates and reporting keep the momentum moving."],
];

const plans = [
  {
    name: "Launch Site",
    price: "$500",
    note: "from · one time",
    text: "Your business, looking like it means it. Custom designed, mobile-first and live fast.",
    items: ["One-page sites from $500", "Multi-section sites from $900", "Premium builds from $1,500"],
  },
  {
    name: "Site + Social",
    price: "$900",
    note: "from · + $250/mo",
    text: "A complete online front, built and then kept active by one focused team.",
    items: ["Full launch site", "Monthly content calendar", "Branded posts, reels and reporting"],
    featured: true,
  },
  {
    name: "Social Care",
    price: "$250",
    note: "from · per month",
    text: "Already have a site? Keep your social presence current, consistent and on-brand.",
    items: ["One or more platforms", "Posts, reels and stories", "Writing, scheduling and reporting"],
  },
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="SHAI Studio home">SHAI <span>STUDIO</span></a>
        <nav aria-label="Primary navigation">
          <a href="#services">What we build</a>
          <a href="#process">How it works</a>
          <a href="#work">Live work</a>
          <a href="#why">Why us</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <a className="button button-gradient header-cta" href="#contact">Claim your slot <Arrow /></a>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><i /> SHAI Studio · AI-native websites + social · now booking</p>
          <h1>They look you up<br />before they walk in.<br /><em>Win that moment.</em></h1>
          <p className="hero-lede">AI-built websites and social for small businesses, crafted fast, polished deeply, and live in about two weeks.</p>
          <div className="hero-actions">
            <a className="button button-gradient" href="#contact">Claim your slot <Arrow /></a>
            <a className="button button-outline" href="#work">See a live site <Arrow /></a>
          </div>
          <div className="hero-meta">
            <span><i /> Now booking</span>
            <span>Limited monthly slots</span>
            <span>Typical launch · ~2 weeks</span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="portal">
            <div className="portal-plane plane-one" />
            <div className="portal-plane plane-two" />
            <div className="portal-core" />
          </div>
          <div className="mesh mesh-a" />
          <div className="mesh mesh-b" />
          <div className="glass-card">
            <div><b>AI-native by design</b><span>Smarter builds, faster launches.</span></div>
            <div><b>Human at the core</b><span>Strategy, voice and craft that feel like you.</span></div>
          </div>
        </div>
        <a className="scroll-cue" href="#services">Scroll <span>↓</span></a>
      </section>

      <div className="ticker" aria-hidden="true">
        <div>Websites that sell <b>◆</b> Social that never sleeps <b>◆</b> AI under the hood <b>◆</b> Live in about two weeks <b>◆</b> Websites that sell <b>◆</b> Social that never sleeps</div>
      </div>

      <section className="section services" id="services">
        <div className="section-intro">
          <p className="eyebrow">What we build</p>
          <h2>Three things.<br /><em>Zero wasted motion.</em></h2>
          <p>We focus on what puts customers in your seats, carts and calendars.</p>
        </div>
        <div className="service-list">
          {services.map((service) => (
            <article className="service-card" key={service.number}>
              <div className="service-index">{service.number} / {service.label}</div>
              <h3>{service.title}</h3>
              <p>{service.text}</p>
              <ul>{service.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
            </article>
          ))}
        </div>
      </section>

      <section className="proof section">
        <p className="eyebrow">Why it matters</p>
        <h2>The math your competitors<br /><em>hope you never do.</em></h2>
        <div className="stat-grid">
          <div><strong>3 sec</strong><span>to make a first impression</span></div>
          <div><strong>~2 wks</strong><span>from kickoff to live</span></div>
          <div><strong>24 yrs</strong><span>running real businesses</span></div>
          <div><strong>1 team</strong><span>from strategy through launch</span></div>
        </div>
      </section>

      <section className="section process" id="process">
        <div className="section-intro sticky">
          <p className="eyebrow">How it works</p>
          <h2>From “we should fix it”<br /><em>to live.</em></h2>
        </div>
        <div className="steps">
          {steps.map(([number, title, text]) => (
            <article key={number}>
              <span>{number}</span><div><h3>{title}</h3><p>{text}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="section work" id="work">
        <div className="work-copy">
          <p className="eyebrow">Live work · Lexington, Kentucky</p>
          <h2>Osaka Hamburg</h2>
          <p>A video-led digital storefront with online ordering, gift cards and a menu designed to move guests from craving to checkout.</p>
          <div className="tags"><span>Web design</span><span>Video hero</span><span>Online ordering</span></div>
          <a className="text-link" href="https://www.osakahamburg.com" target="_blank" rel="noreferrer">Visit the live site <Arrow /></a>
        </div>
        <a className="work-visual" href="https://www.osakahamburg.com" target="_blank" rel="noreferrer" aria-label="Visit Osaka Hamburg">
          <span className="japanese">大阪</span>
          <span>OSAKA</span>
          <small>JAPANESE RESTAURANT</small>
          <i>View project ↗</i>
        </a>
      </section>

      <section className="section why" id="why">
        <div className="section-intro">
          <p className="eyebrow">Why SHAI</p>
          <h2>Agency-level craft.<br /><em>Operator-level judgment.</em></h2>
        </div>
        <div className="why-grid">
          <article><span>01</span><h3>AI-native</h3><p>AI is part of the production model from day one, so the work moves faster without looking automated.</p></article>
          <article><span>02</span><h3>Built to perform</h3><p>Every decision is viewed through the same lens as an operator: guest experience, conversion and return.</p></article>
          <article><span>03</span><h3>One accountable team</h3><p>Strategy, design, build, launch and social stay connected. No handoffs and no telephone game.</p></article>
          <article className="operator"><span>Operator-built</span><p>Founded by a hospitality leader with 24 years of experience, from General Manager to multi-property leadership across Hilton, Marriott and IHG brands. We know the difference between a pretty page and one that pays for itself.</p></article>
        </div>
      </section>

      <section className="section pricing" id="pricing">
        <div className="section-intro">
          <p className="eyebrow">Clear pricing</p>
          <h2>Costs less than the customers<br /><em>you are losing.</em></h2>
          <p>Fixed quotes, agreed before work begins. No unexplained retainers or surprise invoices.</p>
        </div>
        <div className="pricing-grid">
          {plans.map((plan) => (
            <article className={plan.featured ? "price-card featured" : "price-card"} key={plan.name}>
              {plan.featured && <span className="popular">Most chosen</span>}
              <h3>{plan.name}</h3>
              <div className="price"><strong>{plan.price}</strong><span>{plan.note}</span></div>
              <p>{plan.text}</p>
              <ul>{plan.items.map((item) => <li key={item}>{item}</li>)}</ul>
              <a className={plan.featured ? "button button-gradient" : "button button-outline"} href="#contact">Get a fixed quote <Arrow /></a>
            </article>
          ))}
        </div>
      </section>

      <section className="contact" id="contact">
        <div>
          <p className="eyebrow">Last step</p>
          <h2>Your competition hopes<br /><em>you close this tab.</em></h2>
          <p>Tell us what you run and what you need. You will usually have a plan and fixed quote within one business day.</p>
        </div>
        <form action="mailto:chris@shaicompanies.com" method="post" encType="text/plain">
          <label>Name<input name="name" required placeholder="Your name" /></label>
          <label>Email<input name="email" type="email" required placeholder="you@business.com" /></label>
          <label>Business<input name="business" required placeholder="Your business" /></label>
          <label>What do you need?<select name="service" defaultValue=""><option value="" disabled>Select one</option><option>Website</option><option>Website + social</option><option>Social care</option><option>Not sure yet</option></select></label>
          <label className="full">Anything else?<textarea name="details" rows={4} placeholder="A little context helps us come prepared." /></label>
          <button className="button button-gradient full" type="submit">Get my fixed quote <Arrow /></button>
        </form>
      </section>

      <footer>
        <a className="brand" href="#top">SHAI <span>STUDIO</span></a>
        <p>AI-native websites and social for small businesses.</p>
        <div><a href="mailto:chris@shaicompanies.com">chris@shaicompanies.com</a><span>© 2026 SHAI Companies</span></div>
      </footer>
    </main>
  );
}
