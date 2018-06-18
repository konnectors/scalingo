const {
  BaseKonnector,
  requestFactory,
  signin,
  scrape,
  saveBills,
  log
} = require('cozy-konnector-libs')
const request = requestFactory({
  // the debug mode shows all the details about http request and responses. Very usefull for
  // debugging but very verbose. That is why it is commented out by default
  // debug: true,
  // activates [cheerio](https://cheerio.js.org/) parsing on each page
  cheerio: false,
  // If cheerio is activated do not forget to deactivate json parsing (which is activated by
  // default in cozy-konnector-libs
  json: true,
  // this allows request-promise to keep cookies between requests
  jar: true
})

const scalingoAuthEndpoint = 'auth.scalingo.com/v1/tokens/exchange'
const scalingoApiUrl = 'https://api.scalingo.com/v1'

module.exports = new BaseKonnector(start)

// The start function is run by the BaseKonnector instance only when it got all the account
// information (fields). When you run this connector yourself in "standalone" mode or "dev" mode,
// the account information come from ./konnector-dev-config.json file
async function start(fields) {
  log('info', 'Authenticating ...')
  let bearerToken = await authenticate(fields.token)
  log('info', 'Successfully logged in')
  log('info', 'Fetching the list of invoices')
  let options = {
    uri: `${scalingoApiUrl}/account/invoices`,
    headers: {
      'Authorization': `Bearer ${ bearerToken }`
    }
  }
  const response = await request(options)

  log('info', 'Parsing list of invoices')
  const documents = await parseResponse(response.invoices)

  log('info', 'Saving data to Cozy')
  await saveBills(documents, fields.folderPath, {
    identifiers: ['MagicIT']
  })
}

async function authenticate(token) {
  let data = await request.post(`https://:${token}@${scalingoAuthEndpoint}`)
  return data.token
}

function parseResponse(invoices) {
  return invoices.map(invoice => ({
    title: invoice.invoice_number,
    amount: invoice.total_price_with_vat,
    fileurl: invoice.pdf_url,
    filename: `${ invoice.billing_month }.pdf`,
    date: invoice.billing_month,
    currency: 'EUR',
    vendor: 'Scalingo',
    metadata: {
      // it can be interesting that we add the date of import. This is not mandatory but may be
      // usefull for debugging or data migration
      importDate: new Date(),
      // document version, usefull for migration after change of document structure
      version: 1
    }
  }))
}
