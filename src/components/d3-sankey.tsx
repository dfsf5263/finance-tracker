'use client'

import { useRef, useEffect, useState } from 'react'
import * as d3 from 'd3-selection'
import { sankey, sankeyLinkHorizontal } from 'd3-sankey'
import { formatCurrency } from '@/lib/utils'

interface SankeyData {
  nodes: Array<{ name: string; type: 'income' | 'user' | 'expense' }>
  links: Array<{ source: number; target: number; value: number; type: 'income' | 'expense' }>
}

interface D3SankeyProps {
  data: SankeyData
  width: number
  height: number
  colors: string[]
}

export function D3Sankey({ data, width, height, colors }: D3SankeyProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{
    visible: boolean
    x: number
    y: number
    content: string
  }>({
    visible: false,
    x: 0,
    y: 0,
    content: '',
  })

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return

    // Clear previous content
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Set up margins
    const margin = { top: 20, right: 140, bottom: 20, left: 140 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    // Create main group
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Create color scale based on node type
    const getNodeColor = (node: { name: string; type: 'income' | 'user' | 'expense' }) => {
      switch (node.type) {
        case 'income':
          return '#10b981' // Green for income
        case 'expense':
          return '#ef4444' // Red for expenses
        case 'user':
          return '#6366f1' // Blue for users
        default:
          return '#9ca3af' // Gray fallback
      }
    }

    // Create link color function
    const getLinkColor = (link: { type: 'income' | 'expense' }) => {
      return link.type === 'income' ? '#10b981' : '#ef4444'
    }

    // Create sankey layout
    const sankeyLayout = sankey<
      { name: string; type: 'income' | 'user' | 'expense' },
      { source: number; target: number; value: number; type: 'income' | 'expense' }
    >()
      .nodeWidth(15)
      .nodePadding(30)
      .extent([
        [0, 0],
        [innerWidth, innerHeight],
      ])

    // Generate the sankey diagram
    const { nodes, links } = sankeyLayout({
      nodes: data.nodes.map((d) => ({ ...d })),
      links: data.links.map((d) => ({ ...d })),
    })

    // Draw links
    g.append('g')
      .selectAll('.link')
      .data(links)
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', sankeyLinkHorizontal())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .attr('stroke', (d) => getLinkColor(d as any))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .attr('stroke-width', (d) => Math.max(1, (d as any).width))
      .attr('fill', 'none')
      .attr('opacity', 0.4)
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        d3.select(this).attr('opacity', 0.7)
        const rect = svgRef.current?.getBoundingClientRect()
        if (rect) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const link = d as any
          setTooltip({
            visible: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            x: (event as any).clientX - rect.left,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            y: (event as any).clientY - rect.top,
            content: `${link.source.name} → ${link.target.name}: ${formatCurrency(link.value)} (${link.type === 'income' ? 'Income' : 'Expense'})`,
          })
        }
      })
      .on('mouseleave', function () {
        d3.select(this).attr('opacity', 0.4)
        setTooltip((prev) => ({ ...prev, visible: false }))
      })

    // Draw nodes
    const node = g
      .append('g')
      .selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')

    node
      .append('rect')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .attr('x', (d) => (d as any).x0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .attr('y', (d) => (d as any).y0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .attr('height', (d) => (d as any).y1 - (d as any).y0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .attr('width', (d) => (d as any).x1 - (d as any).x0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .attr('fill', (d) => getNodeColor(d as any))
      .attr('opacity', 0.9)
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        d3.select(this).attr('opacity', 1)
        const rect = svgRef.current?.getBoundingClientRect()
        if (rect) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const node = d as any
          const incomingTotal = node.targetLinks.reduce(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (sum: number, link: any) => sum + link.value,
            0
          )
          const outgoingTotal = node.sourceLinks.reduce(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (sum: number, link: any) => sum + link.value,
            0
          )
          const nodeValue = Math.max(incomingTotal, outgoingTotal)
          setTooltip({
            visible: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            x: (event as any).clientX - rect.left,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            y: (event as any).clientY - rect.top,
            content: `${node.name}: ${formatCurrency(nodeValue)}`,
          })
        }
      })
      .on('mouseleave', function () {
        d3.select(this).attr('opacity', 0.9)
        setTooltip((prev) => ({ ...prev, visible: false }))
      })

    // Add labels
    node
      .append('text')
      .attr('x', (d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node = d as any
        return node.x0 < innerWidth / 2 ? node.x0 - 10 : node.x1 + 10
      })
      .attr('y', (d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node = d as any
        return (node.y1 + node.y0) / 2
      })
      .attr('dy', '0.35em')
      .attr('text-anchor', (d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node = d as any
        return node.x0 < innerWidth / 2 ? 'end' : 'start'
      })
      .attr('font-size', '13px')
      .attr('font-weight', '500')
      .attr('fill', 'currentColor')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .text((d) => (d as any).name)

    // Add legend
    const legendData = [
      { label: 'Income Sources', color: '#10b981' },
      { label: 'Users', color: '#6366f1' },
      { label: 'Expense Categories', color: '#ef4444' },
    ]

    const legend = svg.append('g').attr('class', 'legend').attr('transform', `translate(20, 20)`)

    const legendItems = legend
      .selectAll('.legend-item')
      .data(legendData)
      .enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(0, ${i * 25})`)

    legendItems
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 18)
      .attr('height', 18)
      .attr('fill', (d) => d.color)
      .attr('rx', 3)

    legendItems
      .append('text')
      .attr('x', 25)
      .attr('y', 9)
      .attr('dy', '0.35em')
      .attr('font-size', '14px')
      .attr('font-weight', '500')
      .attr('fill', 'currentColor')
      .text((d) => d.label)
  }, [data, width, height, colors])

  return (
    <div style={{ position: 'relative' }}>
      <svg ref={svgRef} width={width} height={height} />
      {tooltip.visible && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            marginTop: '-10px',
            pointerEvents: 'none',
          }}
          className="bg-card p-3 border border-gray-200 rounded-lg shadow-lg"
        >
          <p className="text-sm font-medium">{tooltip.content}</p>
        </div>
      )}
    </div>
  )
}
