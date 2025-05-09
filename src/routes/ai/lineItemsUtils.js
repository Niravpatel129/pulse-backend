// Helper function to extract multiple products from a prompt
export function extractProductsFromPrompt(prompt) {
  const products = [];

  // Split by "and" to identify multiple products
  const productSegments = prompt.split(/,\s*and\s*|\s*and\s*|,\s*/);

  productSegments.forEach((segment) => {
    const trimmedSegment = segment.trim();
    if (!trimmedSegment) return;

    // Check if this is a service item
    const isService =
      trimmedSegment.includes('service') ||
      /\b(called|named)\s+([a-zA-Z0-9]+)\b/i.test(trimmedSegment);

    if (isService) {
      // Extract service name
      let serviceName = 'Generic Service';
      const serviceNameMatch = trimmedSegment.match(/\b(called|named)\s+([a-zA-Z0-9]+)\b/i);
      if (serviceNameMatch && serviceNameMatch[2]) {
        serviceName = serviceNameMatch[2];
      } else if (trimmedSegment.includes('dtf')) {
        serviceName = 'DTF Service';
      }

      // Extract price if mentioned
      const priceMatch = trimmedSegment.match(/\$\s*(\d+(?:\.\d+)?)/);
      const price = priceMatch ? `$${parseFloat(priceMatch[1]).toFixed(2)}` : '$50.00';

      // Extract quantity if mentioned
      const qtyMatch =
        trimmedSegment.match(/\b(\d+)\s+(service|item|dtf)\b/i) ||
        trimmedSegment.match(/\bquantity\s+of\s+(\d+)\b/i);
      const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;

      // Build reasoning explanation
      let reasoning = `Name derived from `;
      if (serviceNameMatch && serviceNameMatch[2]) {
        reasoning += `explicit "called ${serviceNameMatch[2]}" in prompt. `;
      } else if (trimmedSegment.includes('dtf')) {
        reasoning += `"dtf" mention in prompt. `;
      } else {
        reasoning += `fallback to generic service name. `;
      }

      reasoning += `Price ${
        priceMatch ? 'extracted from prompt' : 'set to default service price ($50.00)'
      }. `;
      reasoning += `Description generated as generic service description.`;
      reasoning += ` Quantity ${
        qtyMatch ? `of ${qty} extracted from prompt` : 'defaulted to 1 as no quantity specified'
      }.`;

      products.push({
        name: serviceName,
        description: `Service item as requested by customer`,
        price: price,
        type: 'SERVICE',
        qty: qty,
        reasoning: reasoning,
      });

      return;
    }

    // Extract product type
    const typeMatches = trimmedSegment.match(
      /\b(hoodie|shirt|pants|jacket|sweater|hat|cap|beanie|t-shirt|sweatshirt)\b/i,
    );
    if (!typeMatches) return;

    const productType = typeMatches[1].toLowerCase();

    // Extract color
    const colorMatch = trimmedSegment.match(
      /\b(red|blue|green|black|white|gray|purple|yellow|orange|pink|brown)\b/i,
    );
    const color = colorMatch ? colorMatch[1] : null;

    // Extract price
    const priceMatch = trimmedSegment.match(/\$\s*(\d+(?:\.\d+)?)/);
    const priceMentionMatch = trimmedSegment.match(/(?:cost|price|around|about)\s+\$?(\d+)/i);

    // Extract additional descriptors
    const descriptorMatch = trimmedSegment.match(
      /\b(turtle|full[\s-]zip|pullover|graphic|cotton|polyester|wool|denim|regular)\b/i,
    );
    const descriptor = descriptorMatch ? descriptorMatch[1] : null;

    // Extract quantity if mentioned
    const qtyMatch =
      trimmedSegment.match(
        /\b(\d+)\s+(hoodies|shirts|pants|jackets|sweaters|hats|caps|beanies|t-shirts|sweatshirts)\b/i,
      ) ||
      trimmedSegment.match(
        /\b(\d+)\s+(hoodie|shirt|pant|jacket|sweater|hat|cap|beanie|t-shirt|sweatshirt)\b/i,
      ) ||
      trimmedSegment.match(/\bquantity\s+of\s+(\d+)\b/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;

    // Construct product name
    let name = '';
    if (color) name += `${color.charAt(0).toUpperCase() + color.slice(1)} `;
    if (descriptor) name += `${descriptor.charAt(0).toUpperCase() + descriptor.slice(1)} `;
    name += productType.charAt(0).toUpperCase() + productType.slice(1);

    // Generate product description
    let description;
    switch (productType) {
      case 'hoodie':
        description = `Comfortable ${color || ''} cotton-blend hoodie with ${
          trimmedSegment.includes('zip') ? 'full-length zipper' : 'pullover design'
        }, kangaroo pockets and adjustable hood${
          descriptor ? `, featuring a ${descriptor} design` : ''
        }.`;
        break;
      case 'shirt':
        description = `Classic ${color || ''} ${
          trimmedSegment.includes('regular') ? 'regular fit' : 'standard'
        } shirt made of soft, breathable cotton with reinforced stitching.`;
        break;
      default:
        description = `Quality ${
          color || ''
        } ${productType} with standard features and comfortable fit.`;
    }

    // Set price
    let price;
    let priceSource = '';
    if (priceMatch) {
      // Exact price
      price = `$${parseFloat(priceMatch[1]).toFixed(2)}`;
      priceSource = `extracted from exact price in prompt ($${priceMatch[1]})`;
    } else if (priceMentionMatch) {
      // Approximate price
      const basePrice = parseFloat(priceMentionMatch[1]);
      price = `$${(basePrice + 0.99).toFixed(2)}`;
      priceSource = `derived from approximate price in prompt (about $${priceMentionMatch[1]})`;
    } else {
      // Default prices
      const defaultPrices = {
        hoodie: 19.99,
        shirt: 15.99,
        pants: 24.99,
        jacket: 39.99,
        sweater: 29.99,
        hat: 14.99,
        cap: 12.99,
        beanie: 11.99,
        't-shirt': 12.99,
        sweatshirt: 17.99,
      };
      price = `$${defaultPrices[productType] || 19.99}`;
      priceSource = `set to default price for ${productType} products ($${
        defaultPrices[productType] || 19.99
      })`;
    }

    // Build reasoning explanation
    let reasoning = `Name constructed from `;
    const nameComponents = [];
    if (color) nameComponents.push(`color ("${color}")`);
    if (descriptor) nameComponents.push(`descriptor ("${descriptor}")`);
    nameComponents.push(`product type ("${productType}")`);
    reasoning += nameComponents.join(', ') + ` extracted from prompt. `;

    reasoning += `Price ${priceSource}. `;

    reasoning += `Description generated based on standard ${productType} features`;
    if (color) reasoning += `, including color`;
    if (descriptor) reasoning += ` and ${descriptor} characteristics`;
    reasoning += `.`;

    reasoning += ` Quantity ${
      qtyMatch ? `of ${qty} extracted from prompt` : 'defaulted to 1 as no quantity specified'
    }.`;

    products.push({
      name,
      description,
      price,
      type: 'PRODUCT',
      qty: qty,
      reasoning: reasoning,
    });
  });

  // If no products were extracted, provide a fallback
  if (products.length === 0) {
    products.push({
      name: 'Generic Product',
      description: 'Product based on customer request.',
      price: '$19.99',
      type: 'PRODUCT',
      qty: 1,
      reasoning:
        'Generated as fallback when no specific products could be identified in the prompt.',
    });
  }

  return products;
}
