const shell = document.querySelector<HTMLElement>("#shell");

if (shell) {
  shell.innerHTML = `<div class="shell-grid">
    <section class="hero">
      <p class="eyebrow">DETERMINISTIC COMBAT SYSTEMS</p>
      <h1>Shadow<span>Money</span></h1>
      <p class="lede">A fighting-game simulator built from the frame outward: integer physics, authored boxes, snapshots, hashes, and rollback.</p>
      <div class="hero-actions"><a class="button" href="/play/">Enter game</a><a class="text-link" href="/training/?mode=training">Training</a><a class="text-link" href="/login?next=%2Flab%2F">Developer tools</a><a class="text-link" href="https://wizardgang.ai">Wizard Gang ↗</a></div>
    </section>
    <section class="system-card" aria-label="Prototype status">
      <div class="system-heading"><span class="status-dot"></span><span>PROTOTYPE ONLINE</span><code>v0.1</code></div>
      <dl>
        <div><dt>SIMULATION</dt><dd>60 Hz / integer-only</dd></div>
        <div><dt>STATE</dt><dd>snapshotted + hashed</dd></div>
        <div><dt>NETCODE</dt><dd>rollback core ready</dd></div>
        <div><dt>CONTENT</dt><dd>data-driven fighter</dd></div>
      </dl>
      <div class="scanline"></div>
    </section>
  </div>
  <footer><span>HEXFRAME // PUBLIC PLAYTEST</span><span>COMBAT FIRST. GAME SECOND.</span></footer>`;
}
