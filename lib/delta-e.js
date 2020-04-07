// https://github.com/zschuessler/DeltaE
function deltaE2000([l1, a1, b1], [l2, a2, b2], [wl = 1, wc = 1, wh = 1] = []) {
	const abs = Math.abs, sqrt = Math.sqrt, pow = Math.pow, exp = Math.exp, sin = Math.sin, cos = Math.cos, atan2 = Math.atan2;

	const rad2deg = rad => rad * (180 / Math.PI);
	const deg2rad = deg => deg * (Math.PI / 180);

	let tmp;
	const ksubL = wl;
	const ksubC = wc;
	const ksubH = wh;

	const deltaLPrime = l2 - l1;
	const LBar = (l1 + l2) / 2;
	const C1 = sqrt(pow(a1, 2) + pow(b1, 2));
	const C2 = sqrt(pow(a2, 2) + pow(b2, 2));
	const CBar = (C1 + C2) / 2;
	const aPrime1 = a1 + (a1 / 2) * (1 - sqrt(pow(CBar, 7) / (pow(CBar, 7) + pow(25, 7))));
	const aPrime2 = a2 + (a2 / 2) * (1 - sqrt(pow(CBar, 7) / (pow(CBar, 7) + pow(25, 7))));
	const CPrime1 = sqrt(pow(aPrime1, 2) + pow(b1, 2));
	const CPrime2 = sqrt(pow(aPrime2, 2) + pow(b2, 2));
	const CBarPrime = (CPrime1 + CPrime2) / 2;
	const deltaCPrime = CPrime2 - CPrime1;
	const SsubL = 1 + ((0.015 * pow(LBar - 50, 2)) / sqrt(20 + pow(LBar - 50, 2)));
	const SsubC = 1 + 0.045 * CBarPrime;

	const hPrime1 = (b1 === 0 && aPrime1 === 0) ? 0 : (tmp = rad2deg(atan2(b1, aPrime1))) >= 0 ? tmp : tmp + 360;
	const hPrime2 = (b2 === 0 && aPrime2 === 0) ? 0 : (tmp = rad2deg(atan2(b2, aPrime2))) >= 0 ? tmp : tmp + 360;
	const deltahPrime = (C1 === 0 || C2 === 0) ? 0 : (abs(hPrime1 - hPrime2) <= 180) ? (hPrime2 - hPrime1) : (hPrime2 <= hPrime1) ? (hPrime2 - hPrime1) + 360 : (hPrime2 - hPrime1) - 360;
	const deltaHPrime = 2 * sqrt(CPrime1 * CPrime2) * sin(deg2rad(deltahPrime) / 2);
	const HBarPrime = abs(hPrime1 - hPrime2) > 180 ? (hPrime1 + hPrime2 + 360) / 2 : hPrime1 + hPrime2 / 2;
	const T = 1 - 0.17 * cos(deg2rad(HBarPrime - 30)) + 0.24 * cos(deg2rad(2 * HBarPrime)) + 0.32 * cos(deg2rad(3 * HBarPrime + 6)) - 0.20 * cos(deg2rad(4 * HBarPrime - 63));
	const SsubH = 1 + 0.015 * CBarPrime * T;
	const RsubT = -2 * sqrt(pow(CBarPrime, 7) / (pow(CBarPrime, 7) + pow(25, 7))) * sin(deg2rad(60 * exp(-(pow((HBarPrime - 275) / 25, 2)))));

	const lightness = deltaLPrime / (ksubL * SsubL);
	const chroma = deltaCPrime / (ksubC * SsubC);
	const hue = deltaHPrime / (ksubH * SsubH);

	const deltaH = sqrt(pow(lightness, 2) + pow(chroma, 2) + pow(hue, 2) + RsubT * chroma * hue);

	return deltaH;
}

module.exports = deltaE2000;