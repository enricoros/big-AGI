// Future Testing Code
//
// const sampleFC: boolean = false; // aixModel.id.indexOf('models/gemini') === -1;
// const sampleCE: boolean = false; // aixModel.id.indexOf('models/gemini') !== -1;
// if (sampleFC) {
//   aixChatGenerate.tools = [
//     {
//       type: 'function_call',
//       function_call: {
//         name: 'get_capybara_info_given_name_and_color',
//         description: 'Get the info about capybaras. Call one each per name.',
//         input_schema: {
//           properties: {
//             'name': {
//               type: 'string',
//               description: 'The name of the capybara',
//               enum: ['enrico', 'coolio'],
//             },
//             'color': {
//               type: 'string',
//               description: 'The color of the capybara. Mandatory!!',
//             },
//             // 'story': {
//             //   type: 'string',
//             //   description: 'A fantastic story about the capybara. Please 10 characters maximum.',
//             // },
//           },
//           required: ['name'],
//         },
//       },
//     },
//   ];
// }
// if (sampleCE) {
//   aixChatGenerate.tools = [
//     {
//       type: 'code_execution',
//       variant: 'gemini_auto_inline',
//     },
//   ];
// }
