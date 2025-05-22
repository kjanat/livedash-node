"use client";

import { useRef, useEffect, useState } from "react";
import { select } from "d3-selection";
import cloud from "d3-cloud";

interface CloudWord {
  text: string;
  size: number;
  x?: number;
  y?: number;
  rotate?: number;
}

interface WordCloudProps {
  words: {
    text: string;
    value: number;
  }[];
  width?: number;
  height?: number;
}

export default function WordCloud({
  words,
  width = 500,
  height = 300,
}: WordCloudProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!svgRef.current || !isClient || !words.length) return;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous cloud

    // Find the max value for proper scaling
    const maxValue = Math.max(...words.map((w) => w.value || 1));

    // Configure the layout
    const layout = cloud()
      .size([width, height])
      .words(
        words.map((d) => ({
          text: d.text,
          size: 10 + (d.value * 90) / maxValue, // Scale from 10 to 100 based on value
        }))
      )
      .padding(5)
      .rotate(() => (~~(Math.random() * 6) - 3) * 15) // Rotate between -45 and 45 degrees
      .fontSize((d: CloudWord) => d.size)
      .on("end", draw);

    layout.start();

    function draw(words: CloudWord[]) {
      svg
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`)
        .selectAll("text")
        .data(words)
        .enter()
        .append("text")
        .style("font-size", (d: CloudWord) => `${d.size}px`)
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
          (d: CloudWord) =>
            `translate(${d.x || 0},${d.y || 0}) rotate(${d.rotate || 0})`
        )
        .text((d: CloudWord) => d.text);
    }

    // Cleanup function
    return () => {
      svg.selectAll("*").remove();
    };
  }, [words, width, height, isClient]);

  if (!isClient) {
    return (
      <div className="w-full h-full bg-white flex items-center justify-center">
        <span className="text-gray-500">Loading word cloud...</span>
      </div>
    );
  }

  return (
    <div className="flex justify-center w-full h-full">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        aria-label="Word cloud visualization of categories"
      />
    </div>
  );
}
