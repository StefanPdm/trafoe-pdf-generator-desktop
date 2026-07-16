const buildBtn = document.getElementById('build');
const openFolderBtn = document.getElementById('openFolder');
const logEl = document.getElementById('log');
const resultEl = document.getElementById('result');
const discountRow = document.getElementById('discountRow');
const discountInput = document.getElementById('discount');
const priceListRadios = document.querySelectorAll('input[name="priceList"]');

let lastOutPath = null;

document.getElementById('version').textContent = `V ${window.api.version}`;

function appendLog(msg) {
  logEl.textContent += `${msg}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function updateDiscountVisibility() {
  const priceList = document.querySelector('input[name="priceList"]:checked').value;
  discountRow.style.display = priceList === 'haendler' ? 'flex' : 'none';
}
priceListRadios.forEach((radio) => radio.addEventListener('change', updateDiscountVisibility));
updateDiscountVisibility();

window.api.onProgress(appendLog);

buildBtn.addEventListener('click', async () => {
  const priceList = document.querySelector('input[name="priceList"]:checked').value;
  const brandFilter = document.querySelector('input[name="brand"]:checked').value;
  const discountPercent = priceList === 'haendler' ? Number(discountInput.value) || 10 : undefined;
  const useCache = document.getElementById('useCache').checked;

  buildBtn.disabled = true;
  buildBtn.textContent = 'Katalog wird erstellt...';
  logEl.textContent = '';
  resultEl.style.display = 'none';
  openFolderBtn.style.display = 'none';

  try {
    const { outPath, offerCount } = await window.api.buildCatalog({ priceList, discountPercent, brandFilter, useCache });
    lastOutPath = outPath;
    resultEl.textContent = `Katalog mit ${offerCount} Geräten erfolgreich erstellt: ${outPath}`;
    resultEl.style.display = 'block';
    openFolderBtn.style.display = 'block';
  } catch (err) {
    appendLog(`Fehler: ${err.message ?? err}`);
  } finally {
    buildBtn.disabled = false;
    buildBtn.textContent = 'Katalog erstellen';
  }
});

openFolderBtn.addEventListener('click', () => {
  if (lastOutPath) window.api.openFolder(lastOutPath);
});
