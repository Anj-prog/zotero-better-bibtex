declare const Zotero: any

import { Translator } from './lib/translator'
export { Translator }

function node(id, attributes = {}) {
  let _node = JSON.stringify(id)
  const attrs = Object.entries(attributes).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(', ')
  if (attrs) _node += ` [${attrs}]`
  Zotero.write(`  ${_node};\n`)
}

function edge(source, target, attributes = {}) {
  let _edge = `${JSON.stringify(source)} -> ${JSON.stringify(target)}`
  const attrs = Object.entries(attributes).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(', ')
  if (attrs) _edge += ` [${attrs}]`
  Zotero.write(`  ${_edge};\n`)
}

type Item = {
  id: string
  cites: string[]
  relations: string[]
  label: string
  citationKey: string
  uri: string
}

export function doExport() {
  Translator.init('export')

  Zotero.write('digraph CitationGraph {\n')
  Zotero.write('  concentrate=true;\n')

  const add = {
    title: Zotero.getOption('Title'),
    authors: Zotero.getOption('Authors'),
    year: Zotero.getOption('Year'),
  }

  const items: Item[] = []
  for (const item of Translator.items()) {
    if (['note', 'attachment'].includes(item.itemType)) continue

    const label = [ item.citationKey ]

    if (add.title && item.title) {
      label.push(`\u201C${item.title.replace(/"/g, "'")}\u201D`)
    }

    const author = []
    if (add.authors && item.creators && item.creators.length) {
      const name = item.creators?.map(creator => (creator.name || creator.lastName || '').replace(/"/g, "'")).filter(creator => creator).join(', ')
      if (name) author.push(name)
    }
    if (add.year && item.date) {
      let date = Zotero.BetterBibTeX.parseDate(item.date)
      if (date.from) date = date.from
      if (date.year) author.push(`(${date.year})`)
    }
    if (author.length) label.push(author.join(' '))

    items.push({
      id: 'node-' + item.uri.replace(/.*\//, ''),
      label: label.join('\n'),
      relations: (item.relations?.['dc:relation'] || []),
      cites: [].concat.apply([],
        (item.extra || '')
          .split('\n')
          .filter(line => line.startsWith('cites:'))
          .map(line => line.replace(/^cites:/, '').trim())
          .filter(keys => keys)
          .map(keys => keys.split(/\s*,\s*/))
        ),
      citationKey: item.citationKey,
      uri: item.uri,
    })
  }

  for (const item of items) {
    node(item.id, { label: item.label })

    for (const uri of item.relations) {
      const other = items.find(o => o.uri === uri)
      if (other) {
        edge(item.id, other.id)
      } else {
        edge(item.id, uri.replace(/.*\//, ''), { style: 'dashed', dir: 'both' })
      }
    }

    for (const citationKey of item.cites) {
      const other = items.find(o => o.citationKey === citationKey)

      if (other) {
        edge(item.id, other.id)
      } else {
        edge(item.id, citationKey, { style: 'dashed' })
      }
    }
  }

  Zotero.write('}')
}
