'use client'

import { useRef, useEffect, useState } from 'react'
import * as d3 from 'd3-selection'
import { sankey, sankeyLinkHorizontal } from 'd3-sankey'
import { scaleOrdinal } from 'd3-scale'
import { formatCurrency } from '@/lib/utils'

interface SankeyData {
  nodes: Array<{ name: string }>
  links: Array<{ source: number; target: number; value: number }>
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

    // Create color scale
    const colorScale = scaleOrdinal<string>()
      .domain(data.nodes.map((d) => d.name))
      .range(colors)

    // Create sankey layout
    const sankeyLayout = sankey<
      { name: string },
      { source: number; target: number; value: number }
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
      .attr('stroke', (d) => colorScale((d as any).source.name))
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
            content: `${link.source.name} → ${link.target.name}: ${formatCurrency(link.value)}`,
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
      .attr('fill', (d) => colorScale((d as any).name))
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
