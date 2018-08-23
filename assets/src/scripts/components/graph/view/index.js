import { brushSelection, brushX } from 'd3-brush';
import { mouse } from 'd3-selection';
import { createStructuredSelector } from 'reselect';
import ResizeObserver from 'resize-observer-polyfill';

import { link } from 'ngwmn/lib/d3-redux';
import { callIf } from 'ngwmn/lib/utils';

import {
    getActiveClasses, getChartPosition, getCurrentWaterLevelUnit, getCursor,
    getCursorDatum, getLineSegments, getScaleX, getScaleY, getViewBox,
    resetViewport, setAxisYBBox, setCursor, setContainerSize, setViewport
} from '../state';
import { drawAxisX, drawAxisY, drawAxisYLabel } from './axes';
import { drawFocusCircle, drawFocusLine, drawTooltip } from './cursor';
import drawLegend from './legend';
import drawWaterLevels from './water-levels';


/**
 * Draws a clipPath def that may be used to crop a chart to its defined content
 * area.
 * @param  {Object} elem      D3 selector to append to
 * @param  {Object} store     Redux store
 * @param  {String} chartType Kind of chart
 */
const drawClipPath = function (elem, store, chartType) {
    elem.append('defs')
        .append('clipPath')
            .attr('id', `${chartType}-clip-path`)
            .append('rect')
                .call(link(store, (rect, chartPosition) => {
                    rect.attr('x', 0)
                        .attr('y', 0)
                        .attr('width', chartPosition.width)
                        .attr('height', chartPosition.height);
                }, getChartPosition(chartType)));
};

/**
 * Draws a water-levels graph.
 * @param  {Object} store   Redux store
 * @param  {Object} node    DOM node to draw graph into
 * @param  {Object} options {agencycode, siteid} of site to draw
 */
export const drawChart = function (elem, store, chartType) {
    // Each chart gets its own group container, classed .chart
    elem.append('g')
        .classed('chart', true)
        .classed(chartType, true)
        // Draw a clipPath on the chart to enable cropping of content to the
        // current domain.
        .call(drawClipPath, store, chartType)
        // Each chartType is drawn to a specific area of the SVG viewport.
        // Use a transform to set the location here.
        .call(link(store, (elem, pos) => {
            elem.attr('transform', `translate(${pos.x}, ${pos.y})`);
        }, getChartPosition(chartType)))
        // Draw the actual lines/circles for the current water level data set.
        .call(link(store, drawWaterLevels, createStructuredSelector({
            lineSegments: getLineSegments,
            xScale: getScaleX(chartType),
            yScale: getScaleY(chartType)
        })))
        // Draw the y-axis, only for the main chart.
        .call(callIf(chartType === 'main', link(store, drawAxisY, createStructuredSelector({
            yScale: getScaleY(chartType)
        }), (bBox) => {
            // When the bounding box has changed, update the state with it.
            store.dispatch(setAxisYBBox(bBox));
        })))
        // Draw the x-axis, only for the main chart.
        .call(callIf(chartType === 'main', link(store, drawAxisX, createStructuredSelector({
            xScale: getScaleX(chartType),
            layout: getChartPosition(chartType)
        }))))
        // Draw a vertical focus line representing the current cursor location.
        .call(link(store, drawFocusLine, createStructuredSelector({
            cursor: getCursor,
            xScale: getScaleX(chartType),
            yScale: getScaleY(chartType)
        })))
        // Draw a circle around the point nearest the current cursor location.
        .call(link(store, drawFocusCircle, createStructuredSelector({
            cursorPoint: getCursorDatum,
            xScale: getScaleX(chartType),
            yScale: getScaleY(chartType)
        })))
        // To capture mouse events, draw an overlay rect and attach event
        // handlers to it.
        .call(g => {
            g.append('rect')
                .attr('class', 'overlay')
                .attr('x', 0)
                .attr('y', 0)
                // Set the overlay size, including a little extra space to deal
                // with the focus circle when it's drawn on the right-most extent.
                .call(link(store, (rect, layout) => {
                    rect.attr('width', layout.width)
                        .attr('height', layout.height);
                }, getChartPosition(chartType)))
                // Clear the cursor on mouseout
                .on('mouseout', () => {
                    store.dispatch(setCursor(null));
                })
                // Set the cursor on mousemove and mouseover
                .call(link(store, (rect, xScale) => {
                    rect.on('mouseover', () => {
                        const selectedTime = xScale.invert(mouse(rect.node())[0]);
                        store.dispatch(setCursor(selectedTime));
                    });
                    rect.on('mousemove', () => {
                        const selectedTime = xScale.invert(mouse(rect.node())[0]);
                        store.dispatch(setCursor(selectedTime));
                    });
                }, getScaleX(chartType)));
        })
        // If drawing the panner chart, append a brush container and set the
        // viewport when the brush selection changes.
        .call(callIf(chartType === 'panner', link(store, (elem, {chartPos, scaleX}, context) => {
            // Create, or reuse existing, brush container group element
            const gBrush = context ? context.gBrush : elem
                .append('g')
                    .classed('brush', true);

            // Create, or reuse existing, d3-brush object
            const brush = context ? context.brush : brushX()
                .handleSize(1);

            // Create or update viewport change handler for the current
            // chartPos and scaleX.
            brush
                .on('brush.panner end.panner', function () {
                    const selection = brushSelection(this);
                    if (selection) {
                        store.dispatch(setViewport({
                            startDate: scaleX.invert(selection[0]),
                            endDate: scaleX.invert(selection[1])
                        }));
                    } else {
                        store.dispatch(resetViewport());
                    }
                })
                .extent([[0, 0],
                         [chartPos.width, chartPos.height]]);

            // Apply the brush to the DOM
            gBrush.call(brush);

            // Return context, to be passed on next invocation of this function
            return {gBrush, brush};
        }, createStructuredSelector({
            chartPos: getChartPosition(chartType),
            scaleX: getScaleX(chartType)
        }))));
};

/**
 * Attaches a water level graph to a given DOM node.
 * @param  {Object} elem  D3 selector to render graph to
 * @param  {Object} store Redux store
 * @return {Object}       SVG node of rendered graph
 */
export default function (elem, store) {
    // Append a container for the graph.
    // .graph-container is used to scope all the CSS styles.
    const graphContainer = elem.append('div')
        .classed('graph-container', true);

    // Append the chart and axis labels, scoped to .chart-container
    graphContainer.append('div')
        .classed('chart-container', true)
        // Draw the y-axis label on the left of the chart.
        // See the SASS for the flexbox rules driving the layout.
        .call(link(store, drawAxisYLabel, createStructuredSelector({
            unit: getCurrentWaterLevelUnit
        })))
        .call(elem => {
            // Append an SVG container that we will draw to
            elem.append('svg')
                .attr('xmlns', 'http://www.w3.org/2000/svg')
                .call(link(store, (svg, viewBox) => {
                    svg.attr('viewBox', `${viewBox.left} ${viewBox.top} ${viewBox.right - viewBox.left} ${viewBox.bottom - viewBox.top}`);
                }, getViewBox))
                // Draw the bottom chart, enabling pan and zoom functionality
                .call(drawChart, store, 'panner')
                // Draw the main chart, taking up most of the visible area
                .call(drawChart, store, 'main');
        })
        // Draw a tooltip container. This is rendered to the upper-right and
        // shows details of the point closest to the current cursor location.
        .call(link(store, drawTooltip, createStructuredSelector({
            cursorPoint: getCursorDatum,
            unit: getCurrentWaterLevelUnit
        })))
        .call(div => {
            // Create an observer on the .chart-container node.
            // Here, we use a ResizeObserver polyfill to trigger redraws when
            // the CSS-driven size of our container changes.
            const node = div.node();
            let size = {};
            const observer = new ResizeObserver(function (entries) {
                const newSize = {
                    width: parseFloat(entries[0].contentRect.width),
                    height: parseFloat(entries[0].contentRect.height)
                };
                if (size.width !== newSize.width || size.height !== newSize.height) {
                    size = newSize;
                    store.dispatch(setContainerSize(size));
                }
            });
            observer.observe(node);
        });

    // Append the legend
    graphContainer
        .call(link(store, drawLegend, getActiveClasses));
}