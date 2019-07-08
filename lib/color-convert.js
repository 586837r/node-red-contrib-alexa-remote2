// ranges 0..1
function rgb2hex(rgb) {
    [r,g,b] = rgb.map(x => Math.round(x*255));
	return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

// ranges 0..1
function hex2rgb(hex) {
	if(hex[0] === '#') hex.slice(1);
	const num = parseInt(hex, 16);
	const r = (num >> 16 & 255) / 255;
	const g = (num >> 8 & 255) / 255;
	const b = (num & 255) / 255;
    return [r,g,b];
}

// ranges 0..1
function rgb2hsv([r,g,b]) {
    let K = 0.0;

    if(g < b) {
        [b, g] = [g, b];
        K = -1.0;
    }

    if(r < g) {
        [g, r] = [r, g];
        K = -1.0/3.0 - K;
    }

    chroma = r - Math.min(g,b);
    return [
        Math.abs(K + (g-b) / (6.0 * chroma)),
        chroma / r,
        r
    ]
}

// ranges 0..1
function hsv2rgb([h,s,v]) {
	let x = (h%1) * 6.0;
	let i = Math.floor(x);
	let f =	x - i;
	let p = v * (1.0 - s);
	let q = v * (1.0 - s * f);
	let t = v * (1.0 - s * (1.0 - f));

	switch(i) {
		case 0: return [v, t, p];
		case 1: return [q, v, p];
		case 2: return [p, v, t];
		case 3: return [p, q, v];
		case 4: return [t, p, v];
		case 5: return [v, p, q];
	}
}

module.exports = {
    rgb2hex: rgb2hex,
    hex2rgb: hex2rgb,
    rgb2hsv: rgb2hsv,
    hsv2rgb: hsv2rgb
}