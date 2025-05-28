import axios from 'axios';
import clipboardy from 'clipboardy';

const runSoruce = async () => {
  // make api call to https://api-ca.ssactivewear.com/v2/styles/ using axios, basic auth with username and password
  const response = await axios.get('https://api-ca.ssactivewear.com/v2/styles/', {
    auth: {
      username: '427569',
      password: 'f6e9326b-99ae-49c8-abec-0bb388cc9f4d',
    },
  });

  // {
  // "styleID": 15991, // keep
  // "partNumber": "220A4", // keep
  // "brandName": "Berne Apparel", // keep
  // "styleName": "SP401T", // keep
  // "uniqueStyleName": "SP401T", // keep
  // "title": "Tall Signature Sleeve Hooded Pullover", // keep
  // "description": "", // keep
  // "baseCategory": "Wovens", // keep
  // "categories": "916,926,933", // keep
  // "catalogPageNumber": "0",
  // "newStyle": false,
  // "comparableGroup": 0,
  // "companionGroup": 0,
  // "brandImage": "Images/Brand/237_fm.jpg",
  // "styleImage": "Images/Style/15991_fm.jpg",
  // "prop65Chemicals": "",
  // "noeRetailing": false,
  // "boxRequired": false,
  // "sustainableStyle": false
  // }

  // Extract only the fields marked with "// keep" from the API response
  const keepFields = response.data.map((item) => ({
    styleID: item.styleID,
    partNumber: item.partNumber,
    brandName: item.brandName,
    styleName: item.styleName,
    uniqueStyleName: item.uniqueStyleName,
    title: item.title,
    description: item.description.replace(/<[^>]*>/g, '').trim(),
    baseCategory: item.baseCategory,
  }));

  // Copy to clipboard
  const keepFieldsStr = JSON.stringify(keepFields, null, 2);
  await clipboardy.write(keepFieldsStr);
  console.log('Copied to clipboard:', keepFieldsStr);
};

runSoruce();
