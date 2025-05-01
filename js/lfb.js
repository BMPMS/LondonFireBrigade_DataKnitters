
const measureWidth = (text, fontSize) => {
    const context = document.createElement("canvas").getContext("2d");
    context.font = `${fontSize}px Arial`;
    return context.measureText(text).width;
}
const getStackData = (chartData, colors,filterResults) => {

    const colourKeys = Object.keys(colors).reverse();
    // filter out Other from color props to get group names;
    const stackGroups = colourKeys.filter((f) => f !== "Other");
    const stackKeys = filterResults === "" ? colourKeys : [filterResults];
    // format required
    // {Year: 1998, Cats: 232, Dogs: 101, Birds: 22, Fox: 40, Other: 20}
    const dataForStack = Array.from(d3.group(chartData, (d) => d.Year))
        .reduce((acc, entry) => {
            // build object
            const newEntry = {"Year": entry[0]};
            stackKeys.forEach((d) => newEntry[d] = 0);
            // aggregate group or other depending on Group value
            entry[1].forEach((d) => {
                const value = +d.Count;
                if(stackGroups.includes(d.Group) || filterResults !== ""){
                    newEntry[d.Group] += value;
                } else {
                    newEntry["Other"] += value;
                }
                if(!newEntry["Descriptions"]){
                    newEntry["Descriptions"] = [];
                }
                newEntry["Descriptions"] = newEntry["Descriptions"].concat(d.Descriptions)
            })
            acc.push(newEntry);
            return acc;
        }, [])

    return d3.stack().keys(stackKeys)(filterResults === "" ? dataForStack : chartData);
}


const stackedAreaChart = ()  => {

    let chartData = [];
    let allRescues = [];
    let chartWidth = 0;
    let props = {};
    let svg = undefined;
    let filterResults = "";
    let previousFilter = "";
    let dataPathsALL = {};

    const getKey = (currentKey) => Object.keys(props.colors).includes(currentKey) ? currentKey : "Other";

    const resetNewsScroller = (latestNews) => {
        const speedPixelsPerSecond = 200;
        const ticker = d3.select(".news-ticker").html(latestNews);

        ticker.style("animation", "none");
        ticker.node().offsetHeight;
        const tickerWidth = ticker.node().offsetWidth;
        const screenWidth = window.innerWidth;
        const duration = (tickerWidth + screenWidth) / speedPixelsPerSecond;
        ticker.style("animation", `scrollNews ${duration}s linear infinite`);
    }
    const drawAreaChart = (initial) => {

        const {margin, colors} = props;
        const transformX = margin.left + chartWidth + margin.middle;
        const xExtent = d3.extent(chartData, (d) => d.Year);
        const xScale = d3.scaleLinear().domain(xExtent).range([0, chartWidth]);
        const filteredChartData = filterResults === "" ? chartData : allRescues[filterResults];

        const stackData = getStackData(filteredChartData,colors,filterResults);

        const allNews = stackData.length > 1 ? "hover over hexagon slices to filter | click anywhere outside charts to reset" :
            stackData[0].flatMap(d => d.data.Descriptions).join(" | ");

        resetNewsScroller(allNews);

        const yMax = d3.max(stackData, (d) => d3.max(d, (m) => m[1]));
        const yScale = d3.scaleLinear().domain([0,yMax]).range([chartHeight,0]);

        let xAxis = svg.select(".xAxis");
        let yAxis = svg.select(".yAxis");

        if(xAxis.node() === null){
            xAxis = svg.append("g").attr("class","xAxis");
            yAxis = svg.append("g").attr("class","yAxis");
            svg.append("clipPath").attr("id", "yAxisClipPath")
                .append("rect").attr("id","yAxisClipPathRect");
        }

        svg.select("#yAxisClipPathRect")
            .attr("width", margin.left)
            .attr("height", chartHeight + 10)
            .attr("transform", `translate(${-margin.left},-10)`);

        xAxis
            .call(d3.axisBottom(xScale).ticks(5).tickSizeOuter(0))
            .attr("transform", `translate(${transformX},${margin.top + chartHeight})`);

        xAxis.selectAll("path").attr("display", "none");

        xAxis.selectAll("line").attr("display", "none");

        xAxis
            .selectAll("text")
            .attr("visibility","visible")
            .attr("pointer-events", "none")
            .attr("font-weight", 300)
            .attr("fill", "grey")
            .attr("y", 5)
            .attr("font-size", 12)
            .text((d) =>  d);

        yAxis
            .attr("clip-path", "url(#yAxisClipPath)")
            .attr("transform", `translate(${transformX},${margin.top})`)
            .transition()
            .duration(500)
            .call(d3.axisLeft(yScale).ticks(5).tickSizeOuter(0));

        yAxis.selectAll("path").attr("stroke", "#D0D0D0");

        yAxis.selectAll("line")
            .attr("stroke", "#D0D0D0")
            .attr("stroke-width",0.5)
            .attr("x1",0)
            .attr("x2",chartWidth)
            .transition()
            .duration(500)
            .attr("x2", chartWidth)

        yAxis
            .selectAll("text")
            .attr("pointer-events", "none")
            .attr("font-weight", 300)
            .attr("fill", "grey")
            .attr("font-size", 12)
            .attr("x", -5)
            .transition()
            .duration(500)
            .text((d) =>  d > 0 && Number.isInteger(d) ? d : "");

        const areaStart = d3.area()
            .curve(d3.curveMonotoneX )
            .x(d => xScale(d.data.Year))
            .y0(yScale(0))
            .y1(yScale(0));

        const area = d3.area()
             .curve(d3.curveMonotoneX )
            .x(d => xScale(d.data.Year))
            .y0(d => yScale(d[0]))
            .y1(d => yScale(d[1]));


        if(initial){
            stackData.forEach((d) => dataPathsALL[getKey(d.key)] = area(d));
        }

        const stackGroup = svg
            .selectAll(".stackGroup")
            .data(stackData, (d) => getKey(d.key))
            .join((group) => {
                const enter = group.append("g").attr("class", "stackGroup");
                enter.append("path").attr("class", "stackArea");
                enter.append("image").attr("class","stackImage");
                enter.append("text").attr("class","stackLabel");
                enter.append("text").attr("class","stackLabelTotal");
                enter.append("g").attr("class","yearGroup");
                return enter;
            },(update) => update.attr("opacity",1),
                (exit) => {

                exit.selectAll(".stackLabelTotal")
                    .attr("opacity",0);

                exit
                    .attr("opacity",1)
                    .interrupt()
                    .transition()
                    .duration(previousFilter === "" ? 500 : 0)
                    .attr("opacity",(d) => getKey(d.key) === previousFilter ? 1 : 0)
                    .transition()
                    .duration(500)
                    .attr("opacity",0);

                // can share code later
                exit.selectAll(".stackArea")
                    .transition()
                    .duration(500)
                    .attrTween("d", function(d,i,objects) {
                        // Step 1 - animate from singleArea (if relevant) to stackedArea
                        if(getKey(d.key) !== previousFilter) {
                            return  () => d3.select(objects[i]).attr("d")
                        }
                        // always animating from stackedArea to singleArea
                        // EXCEPT when filterResults === "" which is areaStart => area
                        const previous = d3.select(objects[i]).attr("d");
                        const next = dataPathsALL[getKey(d.key)];
                        // flubber needed here as otherwise the area flips
                        return flubber.interpolate(
                            previous,
                            next,
                            {maxSegmentLength: 10}
                        );

                    })
                    return exit})
            ;

        stackGroup.attr("transform", `translate(${transformX},${margin.top})`)

        const getAnimationOpacity = (d) =>{
            const key = getKey(d.key);
            if(filterResults === "" && key !== previousFilter  && !initial) return 0;
            return 1;
        }
        const getAnimationDelay = (d) => {
            if(initial) return 0;
            if(getKey(d.key) === previousFilter && previousFilter !== "Other") return 1200;
            return 500;
        }

        const imageKeys = ["Cat","Dog","Bird"]

        stackGroup.select(".stackImage")
            .filter((d) => imageKeys.includes(d.key))
            .attr("opacity", getAnimationOpacity)
            .attr("width", 25)
            .attr("height", 25)
            .attr("xlink:href", (d) => `images/${d.key}.png`)
            .attr("transform", (d) => `translate(${chartWidth + 5},${filterResults === ""?  yScale((d[0][1])) - 8  : -18})`)
            .interrupt()
            .transition()
            .delay(getAnimationDelay)
            .duration(500)
            .attr("opacity",1);

        stackGroup
            .select(".yearGroup")
            .attr("opacity", 0)
            .interrupt()
            .transition()
            .delay((d) => getAnimationDelay(d) + 500)
            .duration(500)
            .attr("opacity",1);

        stackGroup.select(".stackLabel")
            .attr("opacity", getAnimationOpacity)
            .attr("pointer-events", "none")
            .attr("font-weight", 600)
            .attr("fill", "grey")
            .attr("dominant-baseline","middle")
            .attr("transform", (d) => `translate(${chartWidth + 5 + (imageKeys.includes(d.key) ? 30 : 0)},${filterResults === ""?  yScale((d[0][1])) + 10 : 0})`)
            .attr("font-size", 16)
            .text((d) =>  d.key)
            .interrupt()
            .transition()
            .delay(getAnimationDelay)
            .duration(500)
            .attr("opacity",1);

        stackGroup.select(".stackLabelTotal")
            .attr("opacity", getAnimationOpacity)
            .attr("pointer-events", "none")
            .attr("font-weight", 600)
            .attr("fill", "grey")
            .attr("dominant-baseline","middle")
            .attr("transform", (d) => `translate(${chartWidth + 5},${20})`)
            .attr("font-size", 16)
            .interrupt()
            .transition()
            .delay(getAnimationDelay)
            .duration(500)
            .attr("opacity",1)
            .text((d) =>   d.key === filterResults ? d3.sum(d, (m) => m.data[d.key]) : "")


        stackGroup.select(".stackArea")
            .attr("pointer-events", "none")
            .attr("fill",(d) => colors[d.key] || colors["Other"])
            .interrupt()
           .transition()
           .duration((d) => getKey(d.key) === previousFilter ? 500 : 0)
            .attrTween("d", function(d,i,objects) {
                // this is other only
                // Step 1 - animate from singleArea (if relevant) to stackedArea
                if(getKey(d.key) !== previousFilter) {
                    return  () => d3.select(objects[i]).attr("d") || ""
                }

                // always animating from stackedArea to singleArea
                // EXCEPT when filterResults === "" which is areaStart => area
                const previous = d3.select(objects[i]).attr("d");
                const next = dataPathsALL[getKey(d.key)];
                // flubber needed here as otherwise the area flips
                return flubber.interpolate(
                    previous,
                    next,
                    {maxSegmentLength: 10}
                );

            })
            .transition()
            .duration(!filterResults === "" && previousFilter !== "" && !(filterResults === "Other" && previousFilter === "Other") ? 500 : 0)
            .attr("opacity", getAnimationOpacity)
            .transition()
            .delay(getAnimationDelay)
            .duration(filterResults === "" && !initial ? 0 : 500)
            .attr("opacity", 1)
            .attrTween("d", function(d) {
                // Step 3 - final animation
                // always animating from stackedArea to singleArea
                // EXCEPT when filterResults === "" which is areaStart => area
                const previous = filterResults === "" ? areaStart(d) : dataPathsALL[getKey(d.key)];
                const next = area(d);
                if(filterResults === ""){
                    // d3 interpolate works better with growing areas
                    return d3.interpolate(
                        previous,
                        next,
                        {maxSegmentLength: 10}
                    );
                } else {
                    // flubber needed here as otherwise the area flips
                    return flubber.interpolate(
                        previous,
                        next,
                        {maxSegmentLength: 10}
                    );
                }
            })

        const yearGroup = stackGroup
            .select(".yearGroup")
            .selectAll(".yearDotsGroup")
            .data((d) => {
                if(stackData.length > 1) return [];
                const dotData = d;
                dotData.map((m) => m.fill =  colors[d.key] || colors["Other"])
                return dotData;
            })
            .join((group) => {
                const enter = group.append("g").attr("class", "yearDotsGroup");
                enter.append("text").attr("class", "yearDotLabel");
                enter.append("line").attr("class", "yearDotLine");
                enter.append("circle").attr("class", "yearDot");
                enter.append("rect").attr("class","yearDotRect");
                return enter;
            });

        yearGroup.select(".yearDotLabel")
            .attr("visibility","hidden")
            .attr("pointer-events","none")
            .attr("text-anchor","middle")
            .attr("font-size", 16)
            .attr("x", (d) => xScale(d.data.Year))
            .attr("y",  yScale(0) + 18)
            .attr("fill", "#808080")
            .text((d) => d.data.Year);

        yearGroup.select(".yearDotLine")
            .attr("visibility","hidden")
            .attr("pointer-events","none")
            .attr("x1", (d) => xScale(d.data.Year))
            .attr("x2", (d) => xScale(d.data.Year))
            .attr("y1", yScale(0))
            .attr("y2", (d) => yScale(d[1]))
            .attr("stroke", (d) => d.fill)
            .attr("stroke-width", 1);


        yearGroup.select(".yearDot")
            .attr("cursor","pointer")
            .attr("cx", (d) => xScale(d.data.Year))
            .attr("cy", (d) => yScale(d[1]))
            .attr("fill",(d) => d.fill)
            .attr("r", 3)
            .attr("stroke", "white");

        yearGroup.select(".yearDotRect")
            .attr("x", (d) => xScale(d.data.Year) - (xScale(d.data.Year) - xScale(d.data.Year - 1))/2)
            .attr("fill", "transparent")
            .attr("width", (d) => xScale(d.data.Year) - xScale(d.data.Year - 1))
            .attr("height", chartHeight)
            .on("mouseover", (event, d) => {
                svg.selectAll(".stackArea").attr("fill","white");
                xAxis.selectAll("text").attr("visibility", "hidden");
                svg.selectAll(".yearDot").attr("stroke",  (l) => l.data.Year === d.data.Year ? d.fill : "white");
                svg.selectAll(".yearDotLabel").attr("visibility", (l) => l.data.Year === d.data.Year ? "visible" : "hidden")
                svg.selectAll(".yearDotLine").attr("visibility", (l) => l.data.Year === d.data.Year ? "visible" : "hidden")
                resetNewsScroller(d.data.Descriptions.join(" | "));
            })
            .on("click", (event, d) => {
                svg.selectAll(".stackArea").attr("fill",d.fill);
                xAxis.selectAll("text").attr("visibility", "visible");
                svg.selectAll(".yearDotLabel").attr("visibility",  "hidden");
                svg.selectAll(".yearDotLine").attr("visibility",  "hidden");
                svg.selectAll(".yearDot").attr("stroke","white");
                resetNewsScroller(allNews);
            })



    }
    const chart = (incomingSvg) => {
        svg = incomingSvg;
        drawAreaChart(true);
    }

    chart.filterResults = (value) => {
        previousFilter = JSON.parse(JSON.stringify(filterResults === "" ? "" : getKey(filterResults)));
        svg.selectAll(".stackLabel").transition().duration(100).attr("opacity", 0);
        filterResults = value;
        drawAreaChart(false);
        return chart;
    }

    chart.voronoiChartSource =  (value)  => {
        if (!value) return voronoiChartSource;
        voronoiChartSource = value;
        return chart;
    };

    chart.chartData =  (value)  => {
        if (!value) return chartData;
        chartData = value;
        return chart;
    };

    chart.allRescues =  (value) => {
        if (!value) return allRescues;
        allRescues = value;
        return chart;
    };

    chart.chartWidth =  (value) => {
        if (!value) return chartWidth;
        chartWidth = value;
        return chart;
    };

    chart.chartHeight =  (value) => {
        if (!value) return chartHeight;
        chartHeight = value;
        return chart;
    };

    chart.props =  (value) => {
        if (!value) return props;
        props = value;
        return chart;
    };

    return chart;

}

const voronoiHexChart = () => {

    let chartData = [];
    let chartWidth = 0;
    let props = {};
    let areaChartSource = null;

    const chart = (svg) => {

        const {margin,colors} = props;

        const nonOtherKeys = Object.keys(colors).filter((f) => f !== "Other");

        root = d3.hierarchy({
            name: "root",
            children: chartData
        });

        root.descendants().map((m) => {
            m.value = m.children
                ? d3.sum(m.children, (s) => +s.data.value)
                : +m.data.value;

            if(!m.children){
                m.data.value = +m.data.value;
            }
        });

        const pentagon = d3.range(5).map((i) => {
            const angle = (i / 5) * 2 * Math.PI - Math.PI / 2; // rotate so the flat side is down
            return [
                (chartWidth / 2) + (chartWidth * 0.49 * Math.cos(angle)),
                (chartWidth / 2) + (chartWidth * 0.49 * Math.sin(angle))
            ];
        });

        //6, 26, 36
        let seed = new Math.seedrandom(36);
        const treemap = d3.voronoiTreemap().minWeightRatio(0.001).prng(seed).clip(pentagon);

        treemap(root);

        let allData = root.descendants().filter((f) => f.depth > 0);

        const fontScale = d3
            .scaleLinear()
            .domain(d3.extent(chartData, (d) => d.value))
            .range([6,  35]);


        const nodeGroup = svg
            .selectAll(".voronoiNodeGroup")
            .data(allData, (d) => d.data.name)
            .join((group) => {
                    const enter = group.append("g").attr("class", "voronoiNodeGroup");
                    enter.append("path").attr("class", "voronoiPath");
                    enter.append("text").attr("class", "voronoiLabel");
                    return enter;
                });

        let hoverTimeout;

        nodeGroup.attr(
            "transform",
            `translate(${margin.left},${margin.hexTop}) rotate(18)`
        )
            .on("mouseover", (event, d) => {
                const currentTarget = event.currentTarget;
                hoverTimeout = setTimeout(() => {
                    d3.selectAll(".voronoiNodeGroup").attr("opacity", 0.2);
                    d3.select(currentTarget).attr("opacity",1);
                    areaChartSource.filterResults(d.data.name);
                }, 500);
            })
            .on("mouseout", () => {
                clearTimeout(hoverTimeout);
            })

        nodeGroup
            .select(".voronoiPath")
            .attr("cursor", "pointer")
            .attr("stroke", "#F5F5F2")
            .attr("stroke-width", 2)
            .attr("d", (d) => `M${d.polygon.join(",")}Z`)
            .attr("fill", (d) => colors[d.data.name] ? colors[d.data.name] : colors["Other"])

        svg.on("click", (event) => {
            if(event.srcElement.tagName === "svg"){
                d3.selectAll(".voronoiNodeGroup").attr("opacity", 1);
                areaChartSource.filterResults("");
            }
        })

        const getLabel = (d) => {
            const labelWidthExtent = d3.extent(d.polygon,(d) => d[0]);
            const labelWidth = labelWidthExtent[1] - labelWidthExtent[0];
            const labelHeightExtent = d3.extent(d.polygon,(d) => d[1]);
            const labelHeight = labelHeightExtent[1] - labelHeightExtent[0];
            const fontSize = fontScale(d.data.value);
            const fitsWidth = labelWidth > measureWidth(d.data.name,  fontSize * 1.3);
            const fitsHeight = labelHeight > fontSize * 1.2;
            if(fitsWidth && fitsHeight) return d.data.name;
            return ""

        }
        nodeGroup
            .select(".voronoiLabel")
            .attr("pointer-events", "none")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline","middle")
            .attr("font-size", (d) => fontScale(d.data.value))
            .attr(
                "transform",
                (d) => `translate(${d.polygon.site.x},${d.polygon.site.y}) rotate(-18)`
            )
            .text(getLabel)
            .attr("fill", (d) => nonOtherKeys.includes(d.data.name) ? "white" : "#484848");


    }


    chart.areaChartSource =  (value)  => {
        if (!value) return areaChartSource;
        areaChartSource = value;
        return chart;
    };

    chart.chartData =  (value)  => {
        if (!value) return chartData;
        chartData = value;
        return chart;
    };

    chart.chartWidth =  (value) => {
        if (!value) return chartWidth;
        chartWidth = value;
        return chart;
    };

    chart.props =  (value) => {
        if (!value) return props;
        props = value;
        return chart;
    };

    return chart;
}
