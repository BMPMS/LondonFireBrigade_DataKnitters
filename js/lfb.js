
const measureWidth = (text, fontSize) => {
    const context = document.createElement("canvas").getContext("2d");
    context.font = `${fontSize}px Arial`;
    return context.measureText(text).width;
}

const wrap = (text, width, fontSize) => {
    text.each(function () {
        var text = d3.select(this),
            words = text.text().split(/\s+/).reverse(),
            word,
            line = [],
            lineNumber = 1,
            y = text.attr("y"),
            dy = 0,
            tspan = text
                .text(null)
                .append("tspan")
                .attr("x", 0)
                .attr("y", y)
                .attr("dy", dy);
        while ((word = words.pop())) {
            line.push(word);
            const currentText = line.join(" ");
            tspan.text(currentText);
            if (measureWidth(currentText, fontSize) > width) {
                line.pop();
                tspan.text(line.join(" "));
                line = [word];
                if (word.trim() !== "") {
                    if (tspan.text().trim() === "") {
                        tspan.text(word);
                    } else {
                        lineNumber += 1;
                        tspan = text
                            .append("tspan")
                            .attr("x", 0)
                            .attr("y", y)
                            .attr("dy", fontSize)
                            .text(word);
                    }
                }
            }
        }
    });
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

const stackedAreaChart = ()  => {

    let chartData = [];
    let allRescues = [];
    let chartWidth = 0;
    let props = {};
    let svg = undefined;
    let filterResults = "";
    let previousFilter = "";
    let dataPathsALL = {};
    const transitionTime = 500;

    const getKey = (currentKey) => Object.keys(props.colors).includes(currentKey) ? currentKey : "Other";

    const drawAreaChart = (initial) => {

        const {margin, colors} = props;
        const transformX = margin.left + chartWidth + margin.middle;
        const xExtent = d3.extent(chartData, (d) => d.Year);
        const xScale = d3.scaleLinear().domain(xExtent).range([0, chartWidth]);
        const filteredChartData = filterResults === "" ? chartData : allRescues[filterResults];

        const stackData = getStackData(filteredChartData,colors,filterResults);

        const allNews = stackData.length > 1 ? props.marqueeMessage :
            stackData[0].flatMap(d => d.data.Descriptions).join(" | ");

        resetNewsScroller(allNews);

        const yMax = d3.max(stackData, (d) => d3.max(d, (m) => m[1]));
        const yScale = d3.scaleLinear().domain([0,yMax]).range([chartHeight,0]);

        // static svg elements
        let xAxis = svg.select(".xAxis");
        let yAxis = svg.select(".yAxis");
        let title = svg.select(".chartTitle");
        let subTitle = svg.select(".chartSubtitle");
        let extraInfo = svg.select(".extraInfo");
        let rescuesCount = svg.select(".rescuesCount");
        let rescuesCountExtra = svg.select(".rescuesCountExtra");
        let catInfo = svg.select(".catInfo");
        let catImage = svg.select(".catImage");
        let covidLine = svg.select(".covidLine");

        if(xAxis.node() === null){
            // append if initial draw
            xAxis = svg.append("g").attr("class","xAxis");
            yAxis = svg.append("g").attr("class","yAxis");
            title = svg.append("text").attr("class","chartTitle");
            subTitle = svg.append("text").attr("class","chartSubtitle");
            extraInfo = svg.append("text").attr("class","extraInfo");
            rescuesCountExtra = svg.append("text").attr("class","rescuesCountExtra");
            rescuesCount = svg.append("text").attr("class","rescuesCount");
            catInfo = svg.append("text").attr("class","catInfo");
            catImage = svg.append("image").attr("class","catImage");
            covidLine = svg.append("line").attr("class","covidLine");
            svg.append("clipPath").attr("id", "yAxisClipPath")
                .append("rect").attr("id","yAxisClipPathRect");
        }
        // position static svg elements

        title.attr("x", 40)
            .attr("y",55)
            .attr("font-size",35)
            .attr("fill","#020000")
            .text("Fur, feathers and fire engines");

        subTitle.attr("x", 40)
            .attr("y",85)
            .attr("font-size",20)
            .attr("fill","#020000")
            .text("Animal rescues by the London Fire Brigade from 2009 to 2024");

        const totalRescues = d3.sum(chartData, (d) => d.Count);

        rescuesCount.attr("x", 40)
            .attr("y",margin.top + chartHeight - 20)
            .attr("font-size",30)
            .attr("fill","#020000")
            .text(d3.format(",")(totalRescues));

        rescuesCountExtra.attr("x", 40)
            .attr("y",margin.top + chartHeight)
            .attr("font-size",18)
            .attr("fill","#020000")
            .text("rescues in total");

        extraInfo
            .attr("visibility", filterResults === "" || filterResults === "Cat" ? "visible" : "hidden")
            .attr("transform",`translate(${transformX + xScale(2020)},${margin.top - 75})`)
            .attr("font-size",12)
            .attr("text-anchor","middle")
            .attr("fill","#808080")
            .text("During the COVID-19 lockdowns, pet ownership surged as many sought companionship. This led to a sharp rise in animal rescue calls to fire brigades, which more than doubled.")
            .call(wrap, 255, 12);

        catImage
            .attr("width", 25)
            .attr("height", 25)
            .attr("xlink:href", "images/Cat.png")
            .attr("transform", `translate(${transformX - 85},${margin.top + chartHeight - 100})`)

        catInfo
            .attr("transform",`translate(${transformX - 60},${margin.top + chartHeight - 60})`)
            .attr("font-size",12)
            .attr("text-anchor","end")
            .attr("fill","#808080")
            .text("Research shows sustained interest in cat adoptions compared to dogs, which may partly explain the significant increase in cat rescues.")
            .call(wrap, 140, 12);

        const total2020 = d3.sum(stackData, (d) => d.filter((f) => +f.data.Year === 2020).map((m) => m[1] - m[0]));

        covidLine
            .attr("visibility", filterResults === "" || filterResults === "Cat" ? "visible" : "hidden")
            .attr("stroke", "#808080")
            .attr("stroke-width",0.5)
            .attr("x1", transformX + xScale(2020))
            .attr("x2", transformX + xScale(2020))
            .attr("y1", margin.top - 32)
            .attr("y2", margin.top + yScale(total2020) - 10);

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
            .duration(transitionTime)
            .call(d3.axisLeft(yScale).ticks(5).tickSizeOuter(0));

        yAxis.selectAll("path").attr("stroke", "#D0D0D0");

        yAxis.selectAll("line")
            .attr("stroke", "#D0D0D0")
            .attr("stroke-width",0.5)
            .attr("x1",0)
            .attr("x2",chartWidth)
            .transition()
            .duration(transitionTime)
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
            // save positions for all data for animation
            stackData.forEach((d) => dataPathsALL[getKey(d.key)] = area(d));
        }

        const stackGroup = svg
            .selectAll(".stackGroup")
            .data(stackData, (d) => getKey(d.key))
            .join((group) => {
                const enter = group.append("g").attr("class", "stackGroup");
                enter.append("path").attr("class", "stackArea");
                enter.append("image").attr("class","labelItem stackImage");
                enter.append("text").attr("class","labelItem stackLabel");
                enter.append("text").attr("class","labelItem stackLabelTotal");
                enter.append("g").attr("class","labelItem yearGroup");
                return enter;
            },(update) => update.attr("opacity",1),
                (exit) => {
                // hide labels first
                exit.selectAll(".labelItem")
                    .attr("opacity",0);

                // fade out exit areas delaying previousFilter for fade
                exit
                    .attr("opacity",1)
                    .interrupt()
                    .transition()
                    .duration(previousFilter === "" ? transitionTime : 0)
                    .attr("opacity",(d) => getKey(d.key) === previousFilter ? 1 : 0)
                    .transition()
                    .duration(transitionTime)
                    .attr("opacity",0);


             return exit})


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

        stackGroup.selectAll(".labelItem")
            .attr("opacity", getAnimationOpacity)
            .interrupt()
            .transition()
            .delay(getAnimationDelay)
            .duration(transitionTime)
            .attr("opacity",1);

        stackGroup.select(".stackImage")
            .filter((d) => imageKeys.includes(d.key))
            .attr("width", 25)
            .attr("height", 25)
            .attr("xlink:href", (d) => `images/${d.key}.png`)
            .attr("transform", (d) => `translate(${chartWidth + 5},${filterResults === ""?  yScale((d[0][1])) - 8  : -18})`);

        stackGroup.select(".stackLabel")
            .attr("pointer-events", "none")
            .attr("font-weight", 600)
            .attr("fill", "grey")
            .attr("dominant-baseline","middle")
            .attr("transform", (d) => `translate(${chartWidth + 5 + (imageKeys.includes(d.key) ? 30 : 0)},${filterResults === ""?  yScale((d[0][1])) + 10 : 0})`)
            .attr("font-size", 16)
            .text((d) =>  d.key)

        stackGroup.select(".stackLabelTotal")
            .attr("pointer-events", "none")
            .attr("font-weight", 600)
            .attr("fill", "grey")
            .attr("dominant-baseline","middle")
            .attr("transform",  `translate(${chartWidth + 5},${20})`)
            .attr("font-size", 16)
            .text((d) =>   d.key === filterResults ? d3.sum(d, (m) => m.data[d.key]) : "")


        stackGroup.select(".stackArea")
            .attr("pointer-events", "none")
            .attr("fill",(d) => colors[d.key] || colors["Other"])
            .interrupt()
           .transition()
           .duration((d) => getKey(d.key) === previousFilter ? 500 : 0)
            .attrTween("d", (d,i,objects) => {
                // Step 1 - animate from singleArea (if relevant) to stackedArea
                if(getKey(d.key) !== previousFilter) {
                    return  () => d3.select(objects[i]).attr("d") || "";
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
            .duration(!filterResults === "" && previousFilter !== "" && !(filterResults === "Other" && previousFilter === "Other") ? transitionTime : 0)
            .attr("opacity", getAnimationOpacity)
            .transition()
            .delay(getAnimationDelay)
            .duration(filterResults === "" && !initial ? 0 : 500)
            .attr("opacity", 1)
            .attrTween("d", function(d) {
                // Step 2 - final animation
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
                enter.append("text").attr("class", "yearDotCountLabel");
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

        yearGroup.select(".yearDotCountLabel")
            .attr("visibility","hidden")
            .attr("pointer-events","none")
            .attr("text-anchor","middle")
            .attr("font-size", 12)
            .attr("x", (d) => xScale(d.data.Year))
            .attr("y",  yScale(0) + 32)
            .attr("fill", "#808080")
            .text((d) => `${d[1]} rescues`);

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
            .attr("stroke", "white")
            .attr("r", 0)
            .transition()
            .delay(transitionTime * 2)
            .duration(transitionTime/2)
            .attr("r", (d) => d[1] > 0 ? 3 : 0);

        const filterAreaByYear = (d) => {
            svg.selectAll(".stackArea").attr("fill","white");
            xAxis.selectAll("text").attr("visibility", "hidden");
            svg.selectAll(".yearDot").attr("stroke",  (l) => l.data.Year === d.data.Year ? d.fill : "white");
            svg.selectAll(".yearDotLabel").attr("visibility", (l) => l.data.Year === d.data.Year ? "visible" : "hidden")
            svg.selectAll(".yearDotCountLabel").attr("visibility", (l) => l.data.Year === d.data.Year ? "visible" : "hidden")
            svg.selectAll(".yearDotLine").attr("visibility", (l) => l.data.Year === d.data.Year ? "visible" : "hidden")
            resetNewsScroller(d.data.Descriptions.join(" | "));
        }

        yearGroup.select(".yearDotRect")
            .attr("x", (d) => xScale(d.data.Year) - (xScale(d.data.Year) - xScale(d.data.Year - 1))/2)
            .attr("fill", "transparent")
            .attr("width", (d) => xScale(d.data.Year) - xScale(d.data.Year - 1))
            .attr("height", chartHeight)
            .on("mouseover", (event, d) => {
               filterAreaByYear(d)
            })
            .on("click", (event, d) => {
                const currentFill = svg.selectAll(".stackArea").attr("fill");
                if(currentFill === "white"){
                    svg.selectAll(".stackArea").attr("fill",d.fill);
                    xAxis.selectAll("text").attr("visibility", "visible");
                    svg.selectAll(".yearDotLabel").attr("visibility",  "hidden");
                    svg.selectAll(".yearDotCountLabel").attr("visibility",  "hidden");
                    svg.selectAll(".yearDotLine").attr("visibility",  "hidden");
                    svg.selectAll(".yearDot").attr("stroke","white");
                    resetNewsScroller(allNews);
                } else {
                    filterAreaByYear(d);
                }
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
    let currentAreaFilter = "";

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
            .range([9,  35]);

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

        nodeGroup
            .attr("transform", `translate(${margin.hexLeft},${margin.hexTop}) rotate(18)`)
            .on("mouseover", (event, d) => {
                const currentTarget = event.currentTarget;
                hoverTimeout = setTimeout(() => {
                    d3.selectAll(".voronoiNodeGroup").attr("opacity", 0.2);
                    d3.select(currentTarget).attr("opacity",1);
                    areaChartSource.filterResults(d.data.name);
                    currentAreaFilter = d.data.name;
                }, 500);
            })
            .on("mouseout", () => {
                clearTimeout(hoverTimeout);
            })
            .on("click", (event, d) => {
                const currentTarget = event.currentTarget;
                d3.selectAll(".voronoiNodeGroup").attr("opacity", 0.2);
                d3.select(currentTarget).attr("opacity",1);
                areaChartSource.filterResults(d.data.name);
                currentAreaFilter = d.data.name;
            })

        nodeGroup
            .select(".voronoiPath")
            .attr("cursor", "pointer")
            .attr("stroke", "#F5F5F2")
            .attr("stroke-width", 2)
            .attr("d", (d) => `M${d.polygon.join(",")}Z`)
            .attr("fill", (d) => colors[d.data.name] ? colors[d.data.name] : colors["Other"])

        svg.on("click", (event) => {
            if(event.srcElement.tagName === "svg" && currentAreaFilter !== ""){
                d3.selectAll(".voronoiNodeGroup").attr("opacity", 1);
                areaChartSource.filterResults("");
                currentAreaFilter = "";
            }
        })

        const getLabel = (d) => {
            // hard coding visible labels based on design decision
            const labels = ["Bird","Fox","Dog","Cat", "Deer", "Horse", "Squirrel"]
            return labels.includes(d.data.name) ? d.data.name : "";
        }
        const getLabelX = (d) => {
            const midX = d.polygon.site.x;
            const customXShifts = {"Fox": -10, "Squirrel": -3};
            return customXShifts[d.data.name] ? midX + customXShifts[d.data.name]: midX;
        }

        const getLabelY = (d) => {
            const midY = d.polygon.site.y;
            const customYShifts = {"Fox": -5, "Squirrel": 5};
            return customYShifts[d.data.name] ? midY + customYShifts[d.data.name]: midY;
        }
        nodeGroup
            .select(".voronoiLabel")
            .attr("pointer-events", "none")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline","middle")
            .attr("font-size", (d) => fontScale(d.data.value))
            .attr(
                "transform",
                (d) => `translate(${getLabelX(d)},${getLabelY(d)}) rotate(-18)`
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
