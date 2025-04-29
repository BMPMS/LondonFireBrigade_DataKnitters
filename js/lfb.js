
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
    let voronoiChart = undefined;
    let svg = undefined;
    let filterResults = "";
    let previousFilter = "";
    let otherPath = "";

    const getKey = (currentKey) => Object.keys(props.colors).includes(currentKey) ? currentKey : "Other";

    const drawAreaChart = (initial) => {
        const {margin, colors} = props;
        const xExtent = d3.extent(chartData, (d) => d.Year);
        const xScale = d3.scaleLinear().domain(xExtent).range([0, chartWidth]);
        const filteredChartData = filterResults === "" ? chartData : allRescues[filterResults];

        const stackData = getStackData(filteredChartData,colors,filterResults);

        const yMax = d3.max(stackData, (d) => d3.max(d, (m) => m[1]));
        const yScale = d3.scaleLinear().domain([0,yMax]).range([chartHeight,0]);

        let xAxis = svg.select(".xAxis");
        let yAxis = svg.select(".yAxis");

        if(xAxis.node() === null){
            xAxis = svg.append("g").attr("class","xAxis");
            yAxis = svg.append("g").attr("class","yAxis");
        }

        xAxis
            .call(d3.axisBottom(xScale).ticks(5).tickSizeOuter(0))
            .attr("transform", `translate(${margin.left},${margin.top + chartHeight})`);

        xAxis.selectAll("path").attr("display", "none");

        xAxis.selectAll("line").attr("display", "none");

        xAxis
            .selectAll("text")
            .attr("pointer-events", "none")
            .attr("font-weight", 300)
            .attr("fill", "grey")
            .attr("y", 5)
            .attr("font-size", 12)
            .text((d) =>  d);

        yAxis
            .attr("transform", `translate(${margin.left},${margin.top})`)
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
            .text((d) =>  d > 0 ? d : "");

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
           otherPath = area(stackData.find((f) => f.key === "Other"));
        }

        const stackGroup = svg
            .selectAll(".stackGroup")
            .data(stackData, (d) => getKey(d.key))
            .join((group) => {
                const enter = group.append("g").attr("class", "stackGroup");
                enter.append("path").attr("class", "stackArea");
                enter.append("text").attr("class","stackLabel");
                return enter;
            },(update) => update.attr("opacity",1),
                (exit) => exit
                    .attr("opacity",1)
                    .interrupt()
                    .transition()
                    .duration(1500)
                    .attr("opacity",0));

        stackGroup.attr("transform", `translate(${margin.left},${margin.top})`)

        const getAnimationOpacity = (d) =>{
            const key = getKey(d.key);
            if(filterResults === "" && key !== previousFilter && !initial) return 0;
            return 1;
            ;        }
        const getAnimationDelay = (d) => {
            if(d.key === previousFilter || initial ) return 0;
            return 1500;
        }


        stackGroup.select(".stackLabel")
            .attr("pointer-events", "none")
            .attr("font-weight", 600)
            .attr("fill", "grey")
            .attr("dominant-baseline","middle")
            .attr("transform", (d) => `translate(${chartWidth + 5},${filterResults === ""?  yScale((d[0][1])) + 10 : 0})`)
            .attr("font-size", 16)
            .text((d) => d.key)
            .transition()
            .delay(getAnimationDelay)
            .duration(500)
            .attr("opacity",1)


        stackGroup.select(".stackArea")
            .attr("fill",(d) => colors[d.key] || colors["Other"])
            .on("mouseover", (event, d) => {
                voronoiChartSource.filterResults(d.key);
            })
            .on("mouseout", (event, d) => {
                voronoiChartSource.filterResults("")
            })
            .attr("opacity", getAnimationOpacity)
           .transition()
            .delay(getAnimationDelay)
            .duration(500)
            .attr("opacity", 1)
            .attrTween("d", function(d,i,objects) {
                if(!initial && d.key !== previousFilter && filterResults === ""){
                    return  () => area(d);
                } else {
                    const current = Object.keys(colors).includes(d.key) ? d3.select(objects[i]).attr("d") : otherPath;
                    const previous = initial ? areaStart(d) : current;
                    const next = area(d);
                    if(initial){
                        return d3.interpolate(
                            previous,
                            next,
                            {maxSegmentLength: 10}
                        );
                    } else {
                        return flubber.interpolate(
                            previous,
                            next,
                            {maxSegmentLength: 10}
                        );
                    }
                }
            })



    }
    const chart = (incomingSvg) => {
        svg = incomingSvg;
        drawAreaChart(true);
    }

    chart.filterResults = (value) => {
        previousFilter = JSON.parse(JSON.stringify(getKey(filterResults)));
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
    let areaChartSource = undefined;
    let filterResults = "";
    let root = {};
    let svg = undefined;
    let allDataPaths = {};
    let previousFilter = "";
    const drawVoronoiChart = (initial) => {

        const {margin,colors} = props;

        const nonOtherKeys = Object.keys(colors).filter((f) => f !== "Other");

        const filteredChartData = chartData.reduce((acc, entry) => {
            if(filterResults === ""){
                acc.push(entry);
            } else if (filterResults === "Other"){
                if(!nonOtherKeys.includes(entry.name)){
                    acc.push(entry);
                }
            } else if(nonOtherKeys.includes(filterResults) && entry.name === filterResults){
                acc.push(entry);
            }
            return acc;
        },[])

        root = d3.hierarchy({
            name: "root",
            children: filteredChartData
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
            .domain(d3.extent(filteredChartData, (d) => d.value))
            .range([6, filterResults === "Other" ? 20 : 35]);


        const nodeGroup = svg
            .selectAll(".voronoiNodeGroup")
            .data(allData, (d) => d.data.name)
            .join((group) => {
                const enter = group.append("g").attr("class", "voronoiNodeGroup");
                enter.append("path").attr("class", "voronoiPath");
                enter.append("text").attr("class", "voronoiLabel");
                enter.attr("opacity",1);
                return enter;
            },(update) => update.attr("opacity",1),
                (exit) => exit
                    .attr("opacity",1)
                    .interrupt()
                    .transition()
                    .duration(500)
                    .attr("opacity",0));

        nodeGroup.attr(
            "transform",
            `translate(${chartWidth  + margin.left + margin.middle},${margin.hexTop}) rotate(18)`
        );

        const getAnimationOpacity = (d) =>{
            if(filterResults === "" && d.data.name !== previousFilter && !initial) return 0;
            return 1;
            ;        }
        const getAnimationDelay = (d) => {
            if(d.data.name === previousFilter || initial ) return 0;
            return 500;
        }

        nodeGroup
            .select(".voronoiPath")
            .attr("cursor", "pointer")
            .attr("stroke", "#F5F5F2")
            .attr("stroke-width", 2)
            .attr("fill", (d) => colors[d.data.name] ? colors[d.data.name] : colors["Other"])
            .on("mouseover", (event, d) => {
                areaChartSource.filterResults(d.data.name);
            })
            .on("mouseout", (event, d) => {
                areaChartSource.filterResults("");
            })


            svg.selectAll(".voronoiPath")
                .attr("opacity", getAnimationOpacity)
                .interrupt()
                .transition()
                .delay(getAnimationDelay)
                .duration(1000)
                .attr("opacity", 1)
                .attrTween("d", function(d,i,objects) {
                    const newPath = `M${d.polygon.join(",")}Z`;
                    const current =  d3.select(objects[i]).attr("d");
                    const previous = initial ? newPath : current;
                    const next = newPath;
                    return flubber.interpolate(
                        previous,
                        next
                    );
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
            .attr("fill", (d) => nonOtherKeys.includes(d.data.name) ? "white" : "#484848")
            .attr("opacity", 0)
            .interrupt()
            .transition()
            .delay( getAnimationDelay)
            .duration(500)
            .attr("opacity",1);
    }
    const chart = (incomingSvg) => {

        svg = incomingSvg;

        drawVoronoiChart(true);


    }

    chart.filterResults = (value) => {
        previousFilter = JSON.parse(JSON.stringify(filterResults));
        svg.selectAll(".voronoiLabel").transition().duration(100).attr("opacity", 0);
        filterResults = value;
        drawVoronoiChart(false);
        return chart;
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
