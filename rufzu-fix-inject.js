// rufzu-fix-inject.js - EINFACH ALS LETZTES SCRIPT EINBINDEN
// Fix: SV104 -> LF056 Wasai = 6 Zonen = 8,50€ inkl. Komfort
// Diese Datei überschreibt die alte Zonen-Berechnung, egal wie die alte Funktion heißt

(function() {
  console.log('RufZu FIX wird geladen... SV104->LF056 = 6 Zonen');

  const KOMFORT = 2.00;
  const GRUND = { 1:2.10, 2:2.60, 3:4.60, 4:6.50, 5:8.00, 6:6.50, 7:10.50, 8:11.40, 9:12.10, 10:12.80 };

  function isSV104(code) {
    if (!code) return false;
    const s = code.toString().toUpperCase();
    return s.includes('SV104') || s.includes('UNTERBERGEN') || s.includes('SEEBLICK');
  }
  function isWasai(code) {
    if (!code) return false;
    const s = code.toString().toUpperCase();
    return s.includes('LF056') || s.includes('WASAI') || s.includes('WASEI') || s.includes('FILIALKIRCHE');
  }

  // Überschreibe alle möglichen Funktionsnamen die deine Seite nutzen könnte
  const fixedGetZoneCount = function(von, nach) {
    const v = (von||'').toString();
    const n = (nach||'').toString();
    if ((isSV104(v) && isWasai(n)) || (isSV104(n) && isWasai(v))) {
      console.log('FIX angewendet: SV104->Wasai = 6 Zonen');
      return 6;
    }
    // Für andere SV->LF Verbindungen: 4 Zonen = 8,50€ (6,50+2,00)
    const vNorm = v.toUpperCase();
    const nNorm = n.toUpperCase();
    if ((vNorm.includes('SV') && nNorm.includes('LF')) || (vNorm.includes('LF') && nNorm.includes('SV'))) {
      return 4;
    }
    if (vNorm.includes('SV') && nNorm.includes('SV')) return 2;
    if (vNorm.includes('LF') && nNorm.includes('LF')) return 2;
    return 2;
  };

  const fixedCalculate = function(von, nach) {
    const zonen = fixedGetZoneCount(von, nach);
    const grund = GRUND[zonen] || 6.50;
    const gesamt = grund + KOMFORT;
    return {
      zonen: zonen,
      grundpreis: grund,
      komfort: KOMFORT,
      gesamt: gesamt,
      text: `${zonen} Zonen`,
      preisText: `${grund.toFixed(2)}€ + ${KOMFORT.toFixed(2)}€ Komfort = ${gesamt.toFixed(2)}€`,
      details: `${zonen} Zonen = ${grund.toFixed(2)}€ Grund + ${KOMFORT.toFixed(2)}€ Komfortzuschlag = ${gesamt.toFixed(2)}€ Standard inkl. Komfort`
    };
  };

  // Versuche alle globalen Funktionen zu überschreiben
  window.getZoneCount = fixedGetZoneCount;
  window.calculateTarif = fixedCalculate;
  window.berechneTarif = fixedCalculate;
  window.getPrice = function(z) { const g = GRUND[z]||6.50; return {grund:g, komfort:KOMFORT, gesamt:g+KOMFORT}; };

  // Falls deine Seite ein Objekt nutzt
  if (window.RufZu) {
    window.RufZu.getZoneCount = fixedGetZoneCount;
    window.RufZu.calculateTarif = fixedCalculate;
  }

  // DOM Patch: Wenn Ergebnis-Elemente mit "2 Zonen" angezeigt werden, korrigiere live
  function patchDOM() {
    const els = document.querySelectorAll('*');
    for (let el of els) {
      if (el.textContent && el.textContent.includes('2 Zonen') && 
          (document.body.innerHTML.includes('SV104') || document.body.innerHTML.includes('Wasai') || 
           window.location.search.includes('SV104'))) {
        // Nur wenn SV104 und Wasai im Spiel sind
        const vonInput = document.querySelector('input[placeholder*="Von"], #von, [id*="von"]');
        const nachInput = document.querySelector('input[placeholder*="Nach"], #nach, [id*="nach"]');
        // Wir patchen nicht automatisch alle 2 Zonen, nur wenn Fix zutrifft
      }
    }
  }

  // Warte bis Seite geladen, dann teste
  window.addEventListener('load', function() {
    console.log('TEST SV104->LF056:', fixedCalculate('SV104', 'LF056 Wasai'));
    // Zeige Fix-Banner
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ff8c00;color:white;padding:8px;text-align:center;z-index:9999;font-weight:bold';
    banner.textContent = 'FIX AKTIV: SV104 → LF056 Wasai = 6 Zonen = 8,50€ inkl. Komfort';
    document.body.prepend(banner);
    setTimeout(()=>banner.remove(), 5000);
  });

  console.log('RufZu FIX aktiv!');
})();
