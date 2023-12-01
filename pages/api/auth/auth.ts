import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(_: NextApiRequest, res: NextApiResponse) {
  res.setHeader('WWW-authenticate', 'Basic realm="Private Area"')
  res.statusCode = 401
  res.end(`Auth Required.`)
}