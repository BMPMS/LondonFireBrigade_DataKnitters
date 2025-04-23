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

    const drawChart = () => {
        const {margin, colors} = props;
        const xExtent = d3.extent(chartData, (d) => d.Year);
        const xScale = d3.scaleLinear().domain(xExtent).range([0, chartWidth]);

        const filteredChartData = filterResults === "" ? chartData : allRescues[filterResults];

        const stackData = getStackData(filteredChartData,colors,filterResults);

        const yMax = d3.max(stackData, (d) => d3.max(d, (m) => m[1]));
        const yScale = d3.scaleLinear().domain([0,yMax]).range([chartHeight,0]);


        let xAxis = svg.select(".xAxis");
        let yAxis = svg.select(".yAxisLabel");
        if(xAxis.node() === null){
            xAxis = svg.append("g").attr("class","xAxis");
            yAxis = svg.append("text").attr("class","yAxisLabel");
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
            .attr("pointer-events", "none")
            .attr("font-weight", 600)
            .attr("fill", "grey")
            .attr("dominant-baseline","middle")
            .attr("transform", `translate(${margin.left + chartWidth + 5},${margin.top + 20})`)
            .attr("font-size", 16)
            .text(filterResults === "" ? "" : d3.max(stackData[0], (d) => d[1]))

        const area = d3.area()
             .curve(d3.curveMonotoneX )
            .x(d => xScale(d.data.Year))
            .y0(d => yScale(d[0]))
            .y1(d => yScale(d[1]));

        const stackGroup = svg
            .selectAll(".stackGroup")
            .data(stackData, (d) => d.key)
            .join((group) => {
                const enter = group.append("g").attr("class", "stackGroup");
                enter.append("path").attr("class", "stackArea");
                enter.append("text").attr("class","stackLabel");
                return enter;
            });

        stackGroup.attr("transform", `translate(${margin.left},${margin.top})`)

        stackGroup.select(".stackLabel")
            .attr("pointer-events", "none")
            .attr("font-weight", 600)
            .attr("fill", "grey")
            .attr("dominant-baseline","middle")
            .attr("transform", (d) => `translate(${chartWidth + 5},${filterResults === ""?  yScale((d[0][1])) + 10 : 0})`)
            .attr("font-size", 16)
            .text((d) => d.key)

        stackGroup.select(".stackArea")
            .attr("fill",(d) => colors[d.key] || colors["Other"])
            .attr("d",area)
            .on("mouseover", (event, d) => {
                voronoiChartSource.filterResults(d.key);
            })
            .on("mouseout", (event, d) => {
                voronoiChartSource.filterResults("");
            });


    }
    const chart = (incomingSvg) => {
        svg = incomingSvg;
        drawChart();
    }

    chart.filterResults = (value) => {
        filterResults = value;
        drawChart();
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
    let previousPaths = {};
    const drawChart = () => {

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

        //11,21
        let seed = new Math.seedrandom(30);
        const treemap = d3.voronoiTreemap().prng(seed).clip(pentagon);

        treemap(root);


        let allData = root.descendants().filter((f) => f.depth > 0);

        const fontScale = d3
            .scaleLinear()
            .domain(d3.extent(filteredChartData, (d) => d.value))
            .range([6, filterResults === "Other" ? 20 : 35]);

        const nodeGroup = svg
            .selectAll(".nodeGroup")
            .data(allData, (d) => d.data.name)
            .join((group) => {
                const enter = group.append("g").attr("class", "nodeGroup");
                enter.append("path").attr("class", "voronoiPath");
                enter.append("text").attr("class", "voronoiLabel");
                return enter;
            });

        nodeGroup.attr(
            "transform",
            `translate(${chartWidth  + margin.left + margin.middle},${margin.hexTop}) rotate(18)`
        );

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
            .transition()
            .duration(0)
            .attrTween("d", function(d) {
                const previous = previousPaths[d.data.name];
                const next = `M${d.polygon.join(",")}Z`
                // this isn't quite working...
                return d3.interpolatePath(previous, next);
            })
            .transition()
            .duration(0)
            .each((d) => {
                previousPaths[d.data.name] = `M${d.polygon.join(",")}Z`;
            })



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
            .text((d) => d.data.name)
            .attr("fill", (d) => nonOtherKeys.includes(d.data.name) ? "white" : "#484848")
            .attr("opacity", 0)
            .transition()
            .delay(0)
            .duration(0)
            .attr("opacity",1);
    }
    const chart = (incomingSvg) => {

        svg = incomingSvg;

        drawChart();


    }

    chart.filterResults = (value) => {
        filterResults = value;
        drawChart();
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
