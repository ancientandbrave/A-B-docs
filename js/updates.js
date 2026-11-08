/* ==========================================================================
   Latest updates — edit this every week with the theme code release.

   Add the newest release at the TOP. Only the first one is shown on the
   Overview and marked around the site.

   Release:
     date:  release date, YYYY-MM-DD. title is optional.

   Each item:
     page:    the guide it belongs to (see NAV in js/site.js), e.g. 'sections'
     section: optional — a section card (e.g. 'builder-50_50', 'nav-60-menu')
              or a heading id on that page (e.g. 'menu-links')
     type:    'updated' (default) or 'new' — use 'new' only for a new section
     text:    what changed, shown on the Overview
     note:    what people can do now, shown when hovering the tag

   How to write them (checked by `npm test`):
     - For the whole company: plain words, no code, file or developer terms.
     - text: one short statement of what changed. Max 12 words, ends with
       a full stop. Don't start with "You can". e.g. "Banners can show a roundel."
     - note: starts with "Now", max 20 words, ends with a full stop.
       Use the names people see in the Theme editor or Shopify admin.
       e.g. "Now you can tick Add Roundel for a round badge with an image and text."
     - British spelling (colour, centre, favourite). "Ancient + Brave" with a plus.
     - No backticks or HTML: the text is shown as typed.
   ========================================================================== */

window.DOC_UPDATES = [
  {
    date: '2026-11-05',
    // Added by scripts/weekly-release.mjs from dev main changes that went live, then written up by hand.
    items: [
      {
        page: 'cart',
        type: 'new',
        text: 'A new guide to everything in the cart.',
        note: 'Now you can set up free delivery, spend rewards and free gift promotions in one place.',
      },
      {
        page: 'cart',
        section: 'spend-rewards',
        text: 'The cart progress bar can show up to two spend rewards.',
        note: 'Now you can add rewards like £10 off £50 in Theme settings › Carts.',
      },
      {
        page: 'cart',
        section: 'free-gift-chooser',
        text: 'Shoppers can pick a free gift in the cart.',
        note: 'Now you can run a gift promotion with a qualifying collection and a gift collection.',
      },
      {
        page: 'cart',
        section: 'free-gifts-in-the-cart',
        text: 'Free gifts can have their own section in the cart.',
        note: 'Now you can tick Group free gift products into their own cart section in Theme settings › Carts.',
      },
      {
        page: 'sections',
        section: 'main-collection-template',
        text: 'Collection pages have two new promo blocks.',
        note: 'Now you can add a Products Promo block with two products, or a Promo Banner, to the grid.',
      },
      {
        page: 'sections',
        section: 'main-product-template-v2',
        text: 'Product pages can show a flash banner and a gift offer.',
        note: 'Now you can tick Show Flash Banner, and add a gift offer with PDP Add to cart callout.',
      },
      {
        page: 'sections',
        section: 'featured-collection',
        text: 'Product cards can show a View button.',
        note: 'Now you can tick Enable View CTA button to show a View button on each product card.',
      },
      {
        page: 'sections',
        section: 'builder-50_50',
        text: 'Product titles in Add to cart link to the product page.',
        note: 'Now the product title opens the product page, and you can add a Button block to it.',
      },
      {
        page: 'sections',
        section: 'content-cards-grid',
        text: 'Location cards can show address details.',
        note: 'Now you can add Address details to each Location Card.',
      },
      {
        page: 'sections',
        section: 'content-title',
        text: 'Titles can have no block background.',
        note: 'Now you can pick None in Block Background to show the title without a background.',
      },
      {
        page: 'sections',
        section: 'content-article',
        text: 'Article tags now show in gold.',
        note: 'Now the tags under the title are gold, and the section has no background colour.',
      },
      {
        page: 'navigation',
        section: 'nav-60-image-cards',
        text: 'Image cards work better with screen readers.',
        note: 'Now each image card reads out its text, or the image description, to screen readers.',
      },
      {
        page: 'sections',
        text: 'Collection pages can show anchor links to jump down the page.',
        note: 'Now you can add the PLP Anchor Links section to a collection page in the Theme editor.',
      },
      {
        page: 'pdp-subscriptions',
        text: 'Small fixes to the subscription options on product pages.',
        note: 'Now the How subscriptions work colours are fixed, and screen readers name the switcher.',
      },
      {
        page: 'website-releases',
        text: 'Small fixes across the website.',
        note: 'Now the full list of what went live is on Website releases.',
      },
    ],
  },
  {
    date: '2026-10-16',
    items: [
      {
        page: 'sections',
        section: 'v2-banner-video',
        text: 'Banners can show a roundel.',
        note: 'Now you can tick Add Roundel for a round badge with an image and text, placed per screen size.',
      },
      {
        page: 'sections',
        section: 'science-slider-in-tabs',
        text: 'Tabs can switch on their own, and slides can have a title.',
        note: 'Now you can tick Auto switch tabs, add a title over each slide image, or hide a tab label.',
      },
      {
        page: 'sections',
        section: 'builder-50_50-slider',
        text: 'Slides can play on their own, and images can be slides.',
        note: 'Now you can add autoplay to Slider classes, and add an Image block as a slide.',
      },
      {
        page: 'sections',
        section: 'builder-50_50',
        text: 'Donut charts use the new progress colour.',
        note: 'Now the filled part of a donut chart is the darker green.',
      },
      {
        page: 'sections',
        section: 'image-video-4-item-grid',
        text: 'Disclaimer text can include a link.',
        note: 'Now you can add a link to the disclaimer text. Linked text is underlined.',
      },
      {
        page: 'sections',
        section: 'main-collection-template',
        text: 'Promo cards have a new horizontal alignment setting.',
        note: 'Now you can place the text on Single and Double cards to the left, middle or right.',
      },
      {
        page: 'sections',
        section: 'content-image-download-card',
        text: 'Cards without a file now still show their image.',
        note: 'Now a card with no file shows its image, without the download icon.',
      },
      {
        page: 'sections',
        section: 'content-slider-downloadable',
        text: 'Cards without a file now still show their image.',
        note: 'Now a card with no file shows its image, without the download icon.',
      },
      {
        page: 'sections',
        section: 'divider-mountains-sun',
        text: 'The sun now moves smoothly on iPhones.',
        note: 'Now the sun follows its arc while scrolling, without jumping.',
      },
      {
        page: 'navigation',
        section: 'nav-60-health-goals-grid',
        text: 'The health goals grid and entry links have a new design.',
        note: 'Now the health goals grid and /type/ links match the new menu design.',
      },
      {
        page: 'navigation',
        section: 'nav-60-product-cards',
        text: 'Grid layout now has a "View all" button.',
        note: 'Now View all shows as a button below the grid, and as the last card on mobile.',
      },
      {
        page: 'navigation',
        text: 'Search now points people to the quiz.',
        note: 'Now the search panel shows "Not sure where to start?" with a link to the health goals quiz.',
      },
      {
        page: 'navigation',
        text: 'Menus and buttons work better with the keyboard and screen readers.',
        note: 'Now menus open and close with the keyboard, and links and buttons read out clearer labels.',
      },
      {
        page: 'pdp-subscriptions',
        section: 'product-options',
        text: 'The one-time purchase option can be highlighted and show its own perks.',
        note: 'Now you can turn on ATC one time purchase featured, and add perks with OTP purchase info.',
      },
    ],
  },
];
