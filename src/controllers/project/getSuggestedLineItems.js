import Project from '../../models/Project.js';
import ProjectModule from '../../models/ProjectModule.js';
import { processTemplateModule } from '../../utils/processTemplateModule.js';

// Helper function to add timeouts to Promises
const withTimeout = (promise, timeoutMs = 5000, name = 'operation') => {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${name} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
};

export const getSuggestedLineItems = async (req, res) => {
  console.log('[getSuggestedLineItems] Starting with request params:', req.params);

  // Send a quick response header to prevent timeout on the client side
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'X-Accel-Buffering': 'no',
    'Cache-Control': 'no-cache',
  });

  try {
    console.log('[getSuggestedLineItems] Starting to fetch suggested line items');
    const { projectId } = req.params;
    console.log(`[getSuggestedLineItems] Project ID: ${projectId}`);

    // Find project with timeout
    const project = await withTimeout(Project.findById(projectId), 5000, 'Project.findById');
    console.log(`[getSuggestedLineItems] Project found: ${!!project}`);

    if (!project) {
      console.log('[getSuggestedLineItems] Project not found, sending error response');
      return res.end(
        JSON.stringify({
          status: 'error',
          message: 'Project not found',
          statusCode: 404,
        }),
      );
    }

    try {
      console.log('[getSuggestedLineItems] Fetching project modules from database');
      // Get complete module data including versions and content - NOT using lean() to keep Mongoose methods
      const projectModules = await withTimeout(
        ProjectModule.find({ project: projectId })
          .populate('content.fileId')
          .populate('content.templateId')
          .populate('versions.contentSnapshot.fileId'),
        10000,
        'ProjectModule.find',
      );
      console.log(
        `[getSuggestedLineItems] Found ${projectModules?.length || 0} modules in database`,
      );

      // Initialize suggested line items array
      const suggestedLineItems = [];

      if (Array.isArray(projectModules)) {
        for (let i = 0; i < projectModules.length; i++) {
          const module = projectModules[i];
          console.log(
            `[getSuggestedLineItems] Processing module ${i + 1}/${projectModules.length}: ${
              module._id
            }`,
          );

          // Extract module info
          const moduleName = module.name || `Module ${i + 1}`;
          const moduleId = module._id;
          const moduleType = module.moduleType;
          console.log(`[getSuggestedLineItems] Module type: ${moduleType}`);

          let price = '100'; // Default price
          let currency = 'CAD';

          if (moduleType === 'file') {
            price = '50';
            console.log(`[getSuggestedLineItems] File module - using default price: ${price}`);
          } else if (moduleType === 'figma') {
            price = '150';
            console.log(`[getSuggestedLineItems] Figma module - using default price: ${price}`);
          } else if (moduleType === 'template') {
            try {
              // Process template module like getModuleDetails.js does
              console.log(
                `[getSuggestedLineItems] Processing template module with id: ${module._id}`,
              );

              // Create a copy to avoid modifying the original
              const processedModule = JSON.parse(JSON.stringify(module));

              // Process the template module to expand relation fields (same as getModuleDetails.js)
              await processTemplateModule(processedModule);
              console.log(`[getSuggestedLineItems] Template module processed successfully`);

              // Now extract price from the processed module
              price = extractPriceFromProcessedModule(processedModule);
              console.log(`[getSuggestedLineItems] Extracted price: ${price}`);
            } catch (error) {
              console.error(
                `[getSuggestedLineItems] Error processing template module: ${error.message}`,
              );
              // Keep default price on error
            }
          }

          // Create line item
          const lineItem = {
            name: moduleName,
            price,
            currency,
            moduleId,
            moduleType,
          };

          console.log(`[getSuggestedLineItems] Adding line item: ${JSON.stringify(lineItem)}`);
          suggestedLineItems.push(lineItem);
        }
      } else {
        console.log('[getSuggestedLineItems] projectModules is not an array');
      }

      console.log(`[getSuggestedLineItems] Returning ${suggestedLineItems.length} line items`);

      // Send the final response
      return res.end(
        JSON.stringify({
          status: 'success',
          message: 'Suggested line items fetched successfully',
          data: suggestedLineItems,
        }),
      );
    } catch (moduleError) {
      console.error('[getSuggestedLineItems] Error fetching modules:', moduleError);
      return res.end(
        JSON.stringify({
          status: 'error',
          message: `Error fetching modules: ${moduleError.message}`,
          statusCode: 500,
        }),
      );
    }
  } catch (error) {
    console.error('[getSuggestedLineItems] Error:', error);
    return res.end(
      JSON.stringify({
        status: 'error',
        message: `Failed to fetch suggested line items: ${error.message}`,
        statusCode: 500,
      }),
    );
  }
};

/**
 * Extracts price from a processed template module
 * @param {Object} module - The processed module with expanded relation fields
 * @returns {String} - The extracted price or default price if not found
 */
function extractPriceFromProcessedModule(module) {
  try {
    console.log('[extractPriceFromProcessedModule] Starting price extraction');

    // Default price if nothing found
    const defaultPrice = '100';

    // No versions? Return default
    if (!module.versions || !module.versions.length) {
      console.log('[extractPriceFromProcessedModule] No versions found');
      return defaultPrice;
    }

    // Get the current/latest version
    const version =
      module.versions.find((v) => v.number === module.currentVersion) ||
      module.versions[module.versions.length - 1];

    if (!version || !version.contentSnapshot || !version.contentSnapshot.sections) {
      console.log('[extractPriceFromProcessedModule] No sections found in version');
      return defaultPrice;
    }

    const sections = version.contentSnapshot.sections;

    // Iterate through sections and fields to find price
    for (const section of sections) {
      if (!section.fields || !Array.isArray(section.fields)) continue;

      for (const field of section.fields) {
        console.log(
          `[extractPriceFromProcessedModule] Checking field: ${field.fieldName}, type: ${field.fieldType}`,
        );

        // Check direct price fields
        if (
          field.fieldName &&
          (field.fieldName.toLowerCase().includes('price') ||
            field.fieldName.toLowerCase().includes('cost') ||
            field.fieldName.toLowerCase().includes('rate'))
        ) {
          if (field.fieldValue && !isNaN(field.fieldValue)) {
            console.log(
              `[extractPriceFromProcessedModule] Found direct price field: ${field.fieldValue}`,
            );
            return field.fieldValue.toString();
          }
        }

        // Check relation fields with displayValues
        if (field.fieldType === 'relation' && field.fieldValue) {
          console.log(
            `[extractPriceFromProcessedModule] Checking relation field: ${field.fieldName}`,
          );

          // For single relation
          if (!field.multiple && field.fieldValue && field.fieldValue.displayValues) {
            const displayValues = field.fieldValue.displayValues;
            console.log(
              `[extractPriceFromProcessedModule] Relation displayValues: ${JSON.stringify(
                displayValues,
              )}`,
            );

            // Look for price in display values
            for (const key in displayValues) {
              if (
                (key.toLowerCase().includes('price') ||
                  key.toLowerCase().includes('cost') ||
                  key.toLowerCase().includes('rate')) &&
                displayValues[key] &&
                !isNaN(displayValues[key])
              ) {
                console.log(
                  `[extractPriceFromProcessedModule] Found price in relation: ${key} = ${displayValues[key]}`,
                );
                return displayValues[key].toString();
              }
            }
          }

          // For multiple relations
          if (field.multiple && Array.isArray(field.fieldValue)) {
            let totalPrice = 0;
            let priceFound = false;

            for (const relationValue of field.fieldValue) {
              if (relationValue && relationValue.displayValues) {
                for (const key in relationValue.displayValues) {
                  if (
                    (key.toLowerCase().includes('price') ||
                      key.toLowerCase().includes('cost') ||
                      key.toLowerCase().includes('rate')) &&
                    relationValue.displayValues[key] &&
                    !isNaN(relationValue.displayValues[key])
                  ) {
                    const valuePrice = parseFloat(relationValue.displayValues[key]);
                    totalPrice += valuePrice;
                    priceFound = true;
                    console.log(
                      `[extractPriceFromProcessedModule] Found price in relation array: ${valuePrice}`,
                    );
                  }
                }
              }
            }

            if (priceFound) {
              console.log(
                `[extractPriceFromProcessedModule] Total price from relations: ${totalPrice}`,
              );
              return totalPrice.toString();
            }
          }
        }
      }
    }

    console.log(`[extractPriceFromProcessedModule] No price found, using default: ${defaultPrice}`);
    return defaultPrice;
  } catch (error) {
    console.error(`[extractPriceFromProcessedModule] Error: ${error.message}`);
    return '100'; // Default price on error
  }
}

/**
 * Infers a price for template modules by checking for price/cost fields
 * @param {Object} module - The project module object
 * @returns {String} - The inferred price or empty string if no price found
 */
async function inferTemplateModulePrice(module) {
  try {
    console.log(`[inferTemplateModulePrice] Starting price inference for module: ${module._id}`);
    // Just return default price for now to simplify debugging
    return '100';
  } catch (error) {
    console.error('[inferTemplateModulePrice] Error inferring template module price:', error);
    return '100'; // Default fallback price
  }
}

/**
 * Gets price information from a related table record
 * @param {String} tableId - The ID of the related table
 * @param {String} recordId - The ID of the record in the related table
 * @returns {String|null} - The price value or null if not found
 */
async function getRelatedTablePrice(tableId, recordId) {
  try {
    console.log(
      `[getRelatedTablePrice] Using default price for tableId: ${tableId}, recordId: ${recordId}`,
    );
    return null; // Just return null for now to simplify debugging
  } catch (error) {
    console.error('[getRelatedTablePrice] Error getting related table price:', error);
    return null;
  }
}
