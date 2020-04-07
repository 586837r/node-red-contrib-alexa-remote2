// ranges 0..1
function hex2rgb(hex) {
	if (hex[0] === '#') hex = hex.slice(1);
	const num = parseInt(hex, 16);
	const r = (num >> 16 & 255) / 255;
	const g = (num >> 8 & 255) / 255;
	const b = (num & 255) / 255;
	return [r, g, b];
}

// ranges 0..1
function rgb2hex(rgb) {
	[r, g, b] = rgb.map(x => Math.round(x * 255));
	return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// ranges 0..1
function hsv2rgb([h, s, v]) {
	let x = (h % 1) * 6.0;
	let i = Math.floor(x);
	let f = x - i;
	let p = v * (1.0 - s);
	let q = v * (1.0 - s * f);
	let t = v * (1.0 - s * (1.0 - f));

	switch (i) {
		case 0: return [v, t, p];
		case 1: return [q, v, p];
		case 2: return [p, v, t];
		case 3: return [p, q, v];
		case 4: return [t, p, v];
		case 5: return [v, p, q];
	}
}

// ranges 0..1
// http://lolengine.net/blog/2013/01/13/fast-rgb-to-hsv
function rgb2hsv([r, g, b]) {
	let K = 0.0;

	if (g < b) {
		const t = g;
		g = b;
		b = t;
		K = -1.0;
	}

	if (r < g) {
		const t = r;
		r = g;
		g = t;
		K = -1.0 / 3.0 - K;
	}

	chroma = r - Math.min(g, b);
	return [
		Math.abs(K + (g - b) / (6.0 * chroma + Number.EPSILON)),
		chroma / (r + Number.EPSILON),
		r
	];
}

function clamp(v, min, max) {
	return Math.min(Math.max(v, min), max);
}
function clampU8(v) {
	return clamp(v, 0, 255);
}

// ranges 1000..40000 -> 0..1
// http://www.tannerhelland.com/4435/convert-temperature-rgb-algorithm-code/
function tmp2rgb(tmp) {
	tmp = tmp / 100;
	let red, green, blue;

	if (tmp <= 66) {
		red = 255;
		green = clampU8(99.4708025861 * Math.log(tmp) - 161.1195681661);
		blue = tmp <= 19 ? 0 : clampU8(138.5177312231 * Math.log(tmp - 10) - 305.0447927307);
	}
	else {
		red = clampU8(329.698727446 * Math.pow(tmp - 60, -0.1332047592));
		green = clampU8(288.1221695283 * Math.pow(tmp - 60, -0.0755148492));
		blue = 255;
	}

	return [red / 255, green / 255, blue / 255];
}


// rgb ranges 0..1
// xyz ranges refer to a D65/2° standard illuminant
// http://www.easyrgb.com/en/math.php
function rgb2xyz([r, g, b]) {
	r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
	g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
	b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

	r = r * 100;
	g = g * 100;
	b = b * 100;

	const x = r * 0.4124 + g * 0.3576 + b * 0.1805;
	const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
	const z = r * 0.0193 + g * 0.1192 + b * 0.9505;

	return [x, y, z];
}

// xyz ranges refer to a D65/2° standard illuminant
// http://www.easyrgb.com/en/math.php
function xyz2lab([x, y, z], [refX = 100, refY = 100, refZ = 100] = []) {
	x = x / refX;
	y = y / refY;
	z = z / refZ;

	x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x + 16 / 116);
	y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y + 16 / 116);
	z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z + 16 / 116);

	const l = 116 * y - 16;
	const a = 500 * (x - y);
	const b = 200 * (y - z);

	return [l, a, b];
}

module.exports = {
	rgb2hsv: rgb2hsv,
	rgb2hex: rgb2hex,
	rgb2xyz: rgb2xyz,
	rgb2lab: rgb => xyz2lab(rgb2xyz(rgb)),

	hex2hsv: hex => rgb2hsv(hex2rgb(hex)),
	hex2rgb: hex2rgb,
	hex2xyz: hex => rgb2xyz(hex2rgb(hex)),
	hex2lab: hex => xyz2lab(rgb2xyz(hex2rgb(hex))),

	hsv2hex: hsv => rgb2hex(hsv2rgb(hsv)),
	hsv2rgb: hsv2rgb,
	hsv2xyz: hsv => rgb2xyz(hsv2rgb(hsv)),
	hsv2lab: hsv => xyz2lab(rgb2xyz(hsv2rgb(hsv))),

	tmp2hsv: tmp => rgb2hsv(tmp2rgb(tmp)),
	tmp2rgb: tmp2rgb,
	tmp2lab: tmp => xyz2lab(rgb2xyz(tmp2rgb(tmp))),

	xyz2lab: xyz2lab,
};