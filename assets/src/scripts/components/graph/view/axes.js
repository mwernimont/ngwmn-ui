import { axisBottom, axisLeft } from 'd3-axis';
import { timeFormat } from 'd3-time-format';

import { FOCUS_CIRCLE_RADIUS } from './cursor';


/**
 * Draws the x-axis
 * @param  {Object} elem             D3 selector
 * @param  {Function} options.xScale D3 scale function
 * @param  {Object} options.layout   {width, height}
 * @param  {Object} axis             D3 selector returned by previous invocation
 * @return {Object}                  Container for axis (g element)
 */
export const drawAxisX = function (elem, {xScale, layout}, axis) {
    axis = axis || elem
        .append('g')
        .classed('x-axis', true);
    axis.transition().duration(100)
        .attr('transform', `translate(0, ${layout.height})`)
        .call(axisBottom()
            .ticks(layout.width / 100)
            .scale(xScale)
            .tickSizeOuter(0)
            .tickFormat(timeFormat('%b %d, %Y')));
    return axis;
};

/**
 * Draws the y-axis
 * @param  {Object} svg                     D3 selector
 * @param  {Function} options.yScale        D3 scale function
 * @param  {Function} options.cropSvgNode   If non-null, crop this svg node to
 *                                          include the drawn y-axis.
 * @param  {Function} options.containerSize Size of containing SVG node
 * @param  {Object} axis                    D3 selector returned by previous invocation
 * @return {Object}                         Container for axis (g element)
 */
export const drawAxisY = function (elem, {yScale, cropSvgNode, containerSize}, axis) {
    axis = axis || elem
        .append('g')
        .classed('y-axis', true);
    axis.transition().duration(100)
        .attr('transform', 'translate(0, 0)')
        .call(axisLeft()
            .scale(yScale)
            .tickPadding(3)
            .tickSizeOuter(0))
        .on('end', function () {
            if (!cropSvgNode) {
                return;
            }
            try {
                const axisBox = axis.node().getBBox();
                cropSvgNode.attr('viewBox', `${axisBox.x} ${0} ${containerSize.width - axisBox.x + FOCUS_CIRCLE_RADIUS} ${containerSize.height}`);
            } catch (error) {
                // See here for details on why we ignore getBBox() exceptions
                // to fix issues with Firefox:
                // https://bugzilla.mozilla.org/show_bug.cgi?id=612118
                // https://stackoverflow.com/questions/28282295/getbbox-of-svg-when-hidden.
            }
        });
    return axis;
};

/**
 * Draws a y-axis label
 * @param  {Object} elem         D3 selector
 * @param  {String} options.unit Unit of measure of the y-axis
 * @param  {Object} label        Container previously-created by this function
 * @return {Object}              Container of label (span)
 */
export const drawAxisYLabel = function (elem, {unit}, label) {
    // Create a span for the label, if it doesn't already exist
    label = label || elem.append('span')
        .classed('y-label', true);

    // Set the label text
    if (unit) {
        label.text(`Water levels, ${unit}`);
    } else {
        label.text('Water levels');
    }

    return label;
};
