# Troubleshooting Guide: Printful × TikTok Shop Integration

If you are struggling to connect Printful or get your TikTok Shop selling account approved, follow these specific steps to resolve the most common blockers.

## 1. Shipping & Warehouse Configuration (Most Common Failure)
TikTok Shop is extremely strict about where your products are shipping from.

- **Warehouse Address**: In your TikTok Shop Seller Center, you **MUST** add Printful's warehouse as your "Shipping From" address. 
    - **Recommended Address**: 11025 Westlake Dr, Charlotte, NC 28273.
    - If your TikTok Shop uses your home address but the tracking shows it originated from North Carolina, your account will be flagged or rejected.
- **Shipping Templates**: 
    - Go to `TikTok Shop Seller Center` > `Shipping` > `Shipping Templates`.
    - Do **NOT** select "Economy." Use "Standard Shipping."
    - Set your **Handling Time** to **3-5 business days** (to account for Printful's fulfillment time). TikTok will penalize you if you set it to 1-2 days and Printful takes 3 days.

## 2. Business Verification Status
TikTok Shop will not allow the Printful sync to complete if your identity/business verification is still "Pending."

- **Check Status**: Go to `My Account` > `Account Settings` > `Qualification`.
- **Match Details**: Ensure the name and address on your Printful account **exactly match** the documents you uploaded to TikTok. Even small discrepancies in "LLC" vs "Limited Liability Company" can cause a silent sync failure.

## 3. Category Mapping
Some apparel categories on TikTok Shop are "Invite Only" or require additional documentation.

- Ensure your products are mapped to: `Clothing & Accessories > Men's Clothing > Tops > T-shirts`.
- Avoid any categories that mention "Medical," "Protective," or "Luxury Brands" unless you have the trademark authorization uploaded.

## 4. Manual Sync Trigger
Sometimes the automated sync hangs. Try this:
1. In Printful, go to `Stores` > [Your TikTok Shop].
2. Click **Refresh Data**.
3. If products are "Syncing" but not appearing, check the `Sync errors` tab in Printful. It will usually give you a specific error code from TikTok.

## 💡 Pre-launch Strategy
While waiting for approval, we have implemented a **"Notify When Live"** flow on your website. This ensures that every visitor you get today is captured in **Klaviyo**.
- When your shop is approved, you can send a **"Drop is Live"** blast to everyone who signed up.
- This creates an artificial "Sell Out" event, which TikTok's algorithm loves, increasing your shop's visibility.
