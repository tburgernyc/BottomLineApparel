import { Product, allProducts } from '../api/products';
import { escapeHtml, escapeAttr } from '../utils/helpers';
import { showToast } from './toast';
import { submitSubscribe } from '../api/subscribe';

const checkoutModal = document.getElementById('checkout-modal');
const modalSizeGrid = document.getElementById('modal-size-grid');
const modalSelSize = document.getElementById('modal-selected-size') as HTMLInputElement;
const modalSubmitBtn = document.getElementById('modal-step1-btn') as HTMLButtonElement;
const modalUpsellGrid = document.getElementById('modal-upsell-grid');
const modalUpsell = document.getElementById('modal-upsell');

export function openCheckoutModal(product: Product) {
  if (!checkoutModal) return;
  
  const img = document.getElementById('modal-product-img') as HTMLImageElement;
  const title = document.getElementById('modal-product-name');
  const price = document.getElementById('modal-product-price');
  const idInput = document.getElementById('modal-product-id') as HTMLInputElement;

  if (img) { img.src = product.image; img.alt = product.title; }
  if (title) title.textContent = product.title;
  if (price) price.textContent = `$${product.price.toFixed(2)}`;
  if (idInput) idInput.value = String(product.id);

  // Reset size selection
  if (modalSizeGrid) {
    modalSizeGrid.querySelectorAll('.size-tag').forEach(t => t.classList.remove('selected'));
  }
  if (modalSelSize) modalSelSize.value = '';
  if (modalSubmitBtn) modalSubmitBtn.disabled = true;

  populateUpsell(product.id);

  checkoutModal.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
  
  setTimeout(() => {
    document.getElementById('modal-close')?.focus();
  }, 100);
}

export function closeCheckoutModal() {
  if (!checkoutModal) return;
  checkoutModal.setAttribute('hidden', '');
  document.body.style.overflow = '';
}

function populateUpsell(currentId: number) {
  if (!modalUpsell || !modalUpsellGrid) return;
  
  const candidates = [
    ...(allProducts.tshirts || []),
    ...(allProducts.tanks || []),
    ...(allProducts.hoodies || []),
  ].filter(p => p.id !== currentId).slice(0, 4);

  if (!candidates.length) {
    modalUpsell.hidden = true;
    return;
  }

  modalUpsell.hidden = false;
  modalUpsellGrid.innerHTML = candidates.map(p => `
    <div class="upsell-item" tabindex="0" role="button" data-id="${p.id}">
      <img src="${p.image}" alt="${escapeAttr(p.title)}" loading="lazy" width="80" height="80" />
      <span class="upsell-item__name">${escapeHtml(p.title)}</span>
      <span class="upsell-item__price">$${p.price.toFixed(2)}</span>
    </div>
  `).join('');

  modalUpsellGrid.querySelectorAll('.upsell-item').forEach(item => {
    item.addEventListener('click', () => {
        const id = parseInt((item as HTMLElement).dataset.id!, 10);
        const p = [...(allProducts.tshirts || []), ...(allProducts.tanks || []), ...(allProducts.hoodies || [])].find(x => x.id === id);
        if (p) openCheckoutModal(p);
    });
  });
}

// Global modal event listeners
export function initModalListeners() {
    document.getElementById('modal-backdrop')?.addEventListener('click', closeCheckoutModal);
    document.getElementById('modal-close')?.addEventListener('click', closeCheckoutModal);
    
    if (modalSizeGrid) {
        modalSizeGrid.addEventListener('click', (e) => {
            const tag = (e.target as HTMLElement).closest('.size-tag') as HTMLElement;
            if (!tag) return;
            modalSizeGrid.querySelectorAll('.size-tag').forEach(t => t.classList.remove('selected'));
            tag.classList.add('selected');
            if (modalSelSize) modalSelSize.value = tag.dataset.size!;
            if (modalSubmitBtn) modalSubmitBtn.disabled = false;
        });
    }

    modalSubmitBtn?.addEventListener('click', async () => {
        const name = (document.getElementById('modal-name') as HTMLInputElement)?.value.trim();
        const email = (document.getElementById('modal-email') as HTMLInputElement)?.value.trim();
        const size = modalSelSize?.value;
        const productId = (document.getElementById('modal-product-id') as HTMLInputElement)?.value;

        if (!name || !email || !size || !productId) return;

        const product = [...(allProducts.tshirts || []), ...(allProducts.tanks || []), ...(allProducts.hoodies || [])].find(p => String(p.id) === String(productId));
        if (!product || !product.lemonsqueezy_url) {
            showToast('Checkout currently unavailable.', 'error');
            return;
        }

        modalSubmitBtn.disabled = true;
        modalSubmitBtn.textContent = 'Redirecting...';

        try {
            await submitSubscribe({ 
                name, email, size, 
                product_id: String(productId), 
                product_name: product.title, 
                source: 'modal_checkout' 
            });
        } catch (err) {
            console.warn('[checkout] Lead capture failed:', err);
        }

        const checkoutUrl = new URL(product.lemonsqueezy_url);
        checkoutUrl.searchParams.set('checkout[email]', email);
        checkoutUrl.searchParams.set('checkout[name]', name);
        window.location.href = checkoutUrl.toString();
    });
}
