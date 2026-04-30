import { Product, Variant, allProducts } from '../api/products';
import { escapeHtml, escapeAttr } from '../utils/helpers';
import { showToast } from './toast';
import { addItem } from '../cart/state';
import { openCartDrawer } from './cart-drawer';
import { track } from '../analytics/analytics';

const checkoutModal = document.getElementById('checkout-modal');
const variantSection = document.getElementById('modal-variant-section');
const buyBtn = document.getElementById('modal-buy-btn') as HTMLButtonElement | null;
const selectedVariantInput = document.getElementById('modal-selected-variant-id') as HTMLInputElement | null;
const productIdInput = document.getElementById('modal-product-id') as HTMLInputElement | null;
const qtyInput = document.getElementById('modal-quantity') as HTMLInputElement | null;
const modalUpsellGrid = document.getElementById('modal-upsell-grid');
const modalUpsell = document.getElementById('modal-upsell');
const modalMsg = document.getElementById('modal-msg');

let activeProduct: Product | null = null;

function uniqueOptions(variants: Variant[], key: 'color' | 'size'): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of variants) {
    const val = v[key];
    if (val && !seen.has(val)) {
      seen.add(val);
      out.push(val);
    }
  }
  return out;
}

function findMatchingVariant(product: Product, color: string | null, size: string | null): Variant | null {
  return product.variants.find(v =>
    (color === null || v.color === color) &&
    (size === null || v.size === size)
  ) || null;
}

function renderVariantPicker(product: Product) {
  if (!variantSection) return;
  variantSection.innerHTML = '';

  const colors = uniqueOptions(product.variants, 'color');
  const sizes = uniqueOptions(product.variants, 'size');

  // Single-variant product: nothing to pick. Auto-select.
  if (product.variants.length === 1) {
    if (selectedVariantInput) selectedVariantInput.value = String(product.variants[0].id);
    if (buyBtn) buyBtn.disabled = false;
    return;
  }

  if (colors.length > 0) {
    const group = document.createElement('div');
    group.className = 'modal__option-group';
    group.dataset.option = 'color';
    group.innerHTML = `
      <p class="modal__option-label">Color</p>
      <div class="modal__option-buttons">
        ${colors.map((c, i) => `<button class="size-tag ${i === 0 ? 'selected' : ''}" type="button" data-value="${escapeAttr(c)}">${escapeHtml(c)}</button>`).join('')}
      </div>
    `;
    variantSection.appendChild(group);
  }

  if (sizes.length > 0) {
    const group = document.createElement('div');
    group.className = 'modal__option-group';
    group.dataset.option = 'size';
    group.innerHTML = `
      <p class="modal__option-label">Size</p>
      <div class="modal__option-buttons size-grid">
        ${sizes.map((s, i) => `<button class="size-tag ${i === 0 ? 'selected' : ''}" type="button" data-value="${escapeAttr(s)}">${escapeHtml(s)}</button>`).join('')}
      </div>
    `;
    variantSection.appendChild(group);
  }

  // If product has only colors (no sizes) or only sizes (no colors), the single-axis picker is enough.
  // If neither colors nor sizes are distinct (rare, malformed data), fall back to listing every variant by label.
  if (colors.length === 0 && sizes.length === 0 && product.variants.length > 0) {
    const group = document.createElement('div');
    group.className = 'modal__option-group';
    group.dataset.option = 'variant';
    group.innerHTML = `
      <p class="modal__option-label">Choose Variant</p>
      <div class="modal__option-buttons">
        ${product.variants.map(v => `<button class="size-tag" type="button" data-variant-id="${v.id}">${escapeHtml(v.label)}</button>`).join('')}
      </div>
    `;
    variantSection.appendChild(group);
  }

  if (selectedVariantInput) selectedVariantInput.value = '';
  if (buyBtn) buyBtn.disabled = true;
}

function getSelectedOption(option: 'color' | 'size'): string | null {
  const group = variantSection?.querySelector(`.modal__option-group[data-option="${option}"]`);
  if (!group) return null;
  const active = group.querySelector('.size-tag.selected') as HTMLElement | null;
  return active?.dataset.value || null;
}

function updateSelectedVariant() {
  if (!activeProduct || !selectedVariantInput || !buyBtn) return;

  // Direct variant pick (single-axis fallback)
  const directGroup = variantSection?.querySelector('.modal__option-group[data-option="variant"]');
  if (directGroup) {
    const active = directGroup.querySelector('.size-tag.selected') as HTMLElement | null;
    const id = active?.dataset.variantId;
    selectedVariantInput.value = id || '';
    buyBtn.disabled = !id;
    return;
  }

  const colors = uniqueOptions(activeProduct.variants, 'color');
  const sizes = uniqueOptions(activeProduct.variants, 'size');
  const needColor = colors.length > 0;
  const needSize = sizes.length > 0;

  const color = needColor ? getSelectedOption('color') : null;
  const size = needSize ? getSelectedOption('size') : null;

  if ((needColor && !color) || (needSize && !size)) {
    selectedVariantInput.value = '';
    buyBtn.disabled = true;
    return;
  }

  const match = findMatchingVariant(activeProduct, color, size);
  if (!match) {
    selectedVariantInput.value = '';
    buyBtn.disabled = true;
    if (modalMsg) modalMsg.textContent = 'That combination is unavailable.';
    return;
  }

  selectedVariantInput.value = String(match.id);
  buyBtn.disabled = false;
  if (modalMsg) modalMsg.textContent = '';

  // Update price + image to selected variant
  const priceEl = document.getElementById('modal-product-price');
  if (priceEl) priceEl.textContent = `$${match.price.toFixed(2)}`;
  if (match.image) {
    const img = document.getElementById('modal-product-img') as HTMLImageElement | null;
    if (img) img.src = match.image;
  }
}

export function openCheckoutModal(product: Product) {
  if (!checkoutModal) return;
  activeProduct = product;

  const img = document.getElementById('modal-product-img') as HTMLImageElement;
  const title = document.getElementById('modal-product-name');
  const price = document.getElementById('modal-product-price');

  if (img) { img.src = product.image; img.alt = product.title; }
  if (title) title.textContent = product.title;
  if (price) {
    price.textContent = product.min_price === product.max_price
      ? `$${product.min_price.toFixed(2)}`
      : `From $${product.min_price.toFixed(2)}`;
  }
  if (productIdInput) productIdInput.value = String(product.id);
  if (qtyInput) qtyInput.value = '1';
  if (modalMsg) modalMsg.textContent = '';

  renderVariantPicker(product);
  populateUpsell(product.id);
  updateSelectedVariant();

  checkoutModal.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';

  track.viewItem({
    item_id: String(product.id),
    item_name: product.title,
    item_brand: 'Bottom Line Apparel',
    item_category: product.category,
    price: product.min_price,
    quantity: 1,
  });

  setTimeout(() => {
    document.getElementById('modal-close')?.focus();
  }, 100);
}

export function closeCheckoutModal() {
  if (!checkoutModal) return;
  checkoutModal.setAttribute('hidden', '');
  document.body.style.overflow = '';
  activeProduct = null;
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
      <img src="${escapeAttr(p.image)}" alt="${escapeAttr(p.title)}" loading="lazy" width="80" height="80" />
      <span class="upsell-item__name">${escapeHtml(p.title)}</span>
      <span class="upsell-item__price">$${p.min_price.toFixed(2)}</span>
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

export function initModalListeners() {
  document.getElementById('modal-backdrop')?.addEventListener('click', closeCheckoutModal);
  document.getElementById('modal-close')?.addEventListener('click', closeCheckoutModal);

  // Delegate variant button clicks (color/size/direct-variant)
  variantSection?.addEventListener('click', (e) => {
    const tag = (e.target as HTMLElement).closest('.size-tag') as HTMLElement | null;
    if (!tag) return;
    const group = tag.closest('.modal__option-group');
    if (!group) return;
    group.querySelectorAll('.size-tag').forEach(t => t.classList.remove('selected'));
    tag.classList.add('selected');
    updateSelectedVariant();
  });

  // Order success/cancel toast based on URL params (Stripe redirect targets)
  const params = new URLSearchParams(window.location.search);
  const orderStatus = params.get('order');
  if (orderStatus === 'success') {
    showToast('Order placed! Check your email for the receipt.', 'success');
    history.replaceState(null, '', window.location.pathname);
  } else if (orderStatus === 'canceled') {
    showToast('Checkout canceled. Your cart is empty.', 'error');
    history.replaceState(null, '', window.location.pathname);
  }

  buyBtn?.addEventListener('click', () => {
    const variantId = selectedVariantInput?.value;
    const quantity = parseInt(qtyInput?.value || '1', 10) || 1;
    if (!variantId || !activeProduct) {
      if (modalMsg) modalMsg.textContent = 'Please select your options.';
      return;
    }
    const variant = activeProduct.variants.find(v => String(v.id) === variantId);
    if (!variant) {
      if (modalMsg) modalMsg.textContent = 'That variant is unavailable.';
      return;
    }

    const variantLabel = [variant.color, variant.size].filter(Boolean).join(' / ');

    addItem({
      sync_variant_id: variant.id,
      product_id: activeProduct.id,
      title: activeProduct.title,
      variant_label: variantLabel,
      image: variant.image || activeProduct.image,
      price: variant.price,
      quantity,
    });

    track.addToCart({
      item_id: String(variant.id),
      item_name: activeProduct.title,
      item_brand: 'Bottom Line Apparel',
      item_variant: variantLabel,
      price: variant.price,
      quantity,
    });

    showToast(`Added to bag: ${activeProduct.title}${variantLabel ? ` (${variantLabel})` : ''}`, 'success');
    closeCheckoutModal();
    openCartDrawer();
  });
}
