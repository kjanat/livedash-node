"use client";

import { useRef, useEffect, useState } from "react";
import { select } from "d3-selection";
import cloud, { Word } from "d3-cloud";

interface WordCloudProps {
  words: {
    text: string;
    value: number;
  }[];
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
}

export default function WordCloud({
  words,
  width: initialWidth = 500,
  height: initialHeight = 300,
  minWidth = 200,
  minHeight = 200,
}: WordCloudProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [dimensions, setDimensions] = useState({
    width: initialWidth,
    height: initialHeight,
  });

  // Set isClient to true on initial render
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Add effect to detect container size changes
  useEffect(() => {
    if (!containerRef.current || !isClient) return;

    // Create ResizeObserver to detect size changes
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // Ensure minimum dimensions
        const newWidth = Math.max(width, minWidth);
        const newHeight = Math.max(height, minHeight);
        setDimensions({ width: newWidth, height: newHeight });
      }
    });

    // Start observing the container
    resizeObserver.observe(containerRef.current);

    // Cleanup
    return () => {
      resizeObserver.disconnect();
    };
  }, [isClient, minWidth, minHeight]);

  // Effect to render the word cloud whenever dimensions or words change
  useEffect(() => {
    if (!svgRef.current || !isClient || !words.length) return;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous cloud

    // Find the max value for proper scaling
    const maxValue = Math.max(...words.map((w) => w.value || 1));

    // Configure the layout
    const layout = cloud()
      .size([dimensions.width, dimensions.height])
      .words(
        words.map((d) => ({
          text: d.text,
          size: 10 + (d.value * 90) / maxValue, // Scale from 10 to 100 based on value
        }))
      )
      .padding(5)
      .rotate(() => (~~(Math.random() * 6) - 3) * 15) // Rotate between -45 and 45 degrees
      .fontSize((d: Word) => d.size || 10)
      .on("end", draw);

    layout.start();

    function draw(words: Word[]) {
      svg
        .append("g")
        .attr(
          "transform",
          `translate(${dimensions.width / 2},${dimensions.height / 2})`
        )
        .selectAll("text")
        .data(words)
        .enter()
        .append("text")
        .style("font-size", (d: Word) => `${d.size || 10}px`)
        .style("font-family", "Inter, Arial, sans-serif")
        .style("fill", () => {
          // Create a nice gradient of colors
          const colors = [
            "#4299E1", // blue-500
            "#3182CE", // blue-600
            "#2B6CB0", // blue-700
            "#63B3ED", // blue-400
            "#90CDF4", // blue-300
            "#38B2AC", // teal-500
            "#4FD1C5", // teal-400
          ];
          return colors[Math.floor(Math.random() * colors.length)];
        })
        .style("cursor", "pointer")
        .attr("text-anchor", "middle")
        .attr(
          "transform",
          (d: Word) =>
            `translate(${d.x || 0},${d.y || 0}) rotate(${d.rotate || 0})`
        )
        .text((d: Word) => d.text || "");
    }

    // Cleanup function
    return () => {
      svg.selectAll("*").remove();
    };
  }, [words, dimensions, isClient]);

  if (!isClient) {
    return (
      <div className="w-full h-full bg-white flex items-center justify-center">
        <span className="text-gray-500">Loading word cloud...</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex justify-center w-full h-full"
      style={{ minHeight: `${minHeight}px` }}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
        aria-label="Word cloud visualization of categories"
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
        }}
      />
    </div>
  );
}
