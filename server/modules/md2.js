'use strict';

/**
 * Credits for the JS implementation go to:
 * http://crypo.in.ua/tools/eng_md2.php
 */

module.exports = MD2Main;

var MD2contextCount, MD2digest, MD2contextState, MD2contextChecksum, MD2IntInputData, MD2contextBuffer;
var MD2PI_SUBST = [41, 46, 67, 201, 162, 216, 124, 1, 61, 54, 84, 161, 236, 240, 6, 19, 98, 167, 5, 243, 192, 199, 115, 140, 152, 147, 43, 217, 188, 76, 130, 202, 30, 155, 87, 60, 253, 212, 224, 22, 103, 66, 111, 24, 138, 23, 229, 18, 190, 78, 196, 214, 218, 158, 222, 73, 160, 251, 245, 142, 187, 47, 238, 122, 169, 104, 121, 145, 21, 178, 7, 63, 148, 194, 16, 137, 11, 34, 95, 33, 128, 127, 93, 154, 90, 144, 50, 39, 53, 62, 204, 231, 191, 247, 151, 3, 255, 25, 48, 179, 72, 165, 181, 209, 215, 94, 146, 42, 172, 86, 170, 198, 79, 184, 56, 210, 150, 164, 125, 182, 118, 252, 107, 226, 156, 116, 4, 241, 69, 157, 112, 89, 100, 113, 135, 32, 134, 91, 207, 101, 230, 45, 168, 2, 27, 96, 37, 173, 174, 176, 185, 246, 28, 70, 97, 105, 52, 64, 126, 15, 85, 71, 163, 35, 221, 81, 175, 58, 195, 92, 249, 206, 186, 197, 234, 38, 44, 83, 13, 110, 133, 40, 132, 9, 211, 223, 205, 244, 65, 129, 77, 82, 106, 220, 55, 200, 108, 193, 171, 250, 36, 225, 123, 8, 12, 189, 177, 74, 120, 136, 149, 139, 227, 99, 232, 109, 233, 203, 213, 254, 59, 0, 29, 57, 242, 239, 183, 14, 102, 88, 208, 228, 166, 119, 114, 248, 235, 117, 75, 10, 49, 68, 80, 180, 143, 237, 31, 26, 219, 153, 141, 51, 159, 17, 131, 20];

function MD2Main(input) {

	var i;
	var seedStr;
	var myStr;
	var myChar;
	var err;

	MD2contextCount = 0;
	MD2digest = new Array(16);
	MD2contextState = new Array(16);
	MD2contextChecksum = new Array(16);
	MD2IntInputData = [];
	MD2contextBuffer = new Array(16);

	var j = 0;

	seedStr = '' + '!"#$%&';
	seedStr = "" + seedStr + "'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	seedStr = "" + seedStr + "[A]^_Aabcdefghijklmnopqrstuvwxyz{|}~";
	err = 0;

	myStr = escape(input);

	for (i = 0; i < myStr.length; i++) {
		myChar = "" + myStr.charAt(i);
		if (myChar == '%') {
			myChar = "" + myStr.charAt(i + 1) + myStr.charAt(i + 2);
			i += 2;
			myChar = parseInt(myChar, 16);
		} else {
			var iti = seedStr.indexOf(myChar, 0);
			if (iti < 0) {
				throw new Error('Error computing MD2 hash.');
			} else {
				myChar = 33 + iti;
			}
		}
		MD2IntInputData[j] = myChar;
		j++;
	}

	for (i = 0; i++; i < 16) {
		MD2contextChecksum[i] = 0;
		MD2contextState[i] = 0;
		MD2contextBuffer[i] = 0;
		MD2digest[i] = 0;
	}

	MD2Update(MD2IntInputData, MD2IntInputData.length);
	MD2Final();
	return MD2digest;
}

function MD2Update(input, inputLen) {

	var i;
	var myIndex;
	var partLen;

	myIndex = MD2contextCount;
	MD2contextCount = (myIndex + inputLen) & 0x0f;

	partLen = 16 - myIndex;
	if (partLen <= inputLen) {
		MD2Memcpy(MD2contextBuffer, myIndex, input, 0, partLen);
		MD2Transform(MD2contextState, MD2contextChecksum, MD2contextBuffer, 0);

		for (i = partLen; i + 15 < inputLen; i += 16) {
			MD2Transform(MD2contextState, MD2contextChecksum, input, i);
		}
		myIndex = 0;
	} else {
		i = 0;
	}


	MD2Memcpy(MD2contextBuffer, myIndex, input, i, inputLen - i);
}

function MD2Final() {
	var myIndex;
	var padLen;
	var j;
	var MD2PADDING;

	myIndex = MD2contextCount;
	padLen = 16 - myIndex;
	switch (padLen) {
		case 0:

			break;
		case 1:
			MD2PADDING = new Array(1);
			MD2PADDING[0] = 1;
			break;
		case 2:
			MD2PADDING = new Array(2, 2);
			break;
		case 3:
			MD2PADDING = new Array(3, 3, 3);
			break;
		case 4:
			MD2PADDING = new Array(4, 4, 4, 4);
			break;
		case 5:
			MD2PADDING = new Array(5, 5, 5, 5, 5);
			break;
		case 6:
			MD2PADDING = new Array(6, 6, 6, 6, 6, 6);
			break;
		case 7:
			MD2PADDING = new Array(7, 7, 7, 7, 7, 7, 7);
			break;
		case 8:
			MD2PADDING = new Array(8, 8, 8, 8, 8, 8, 8, 8);
			break;
		case 9:
			MD2PADDING = new Array(9, 9, 9, 9, 9, 9, 9, 9, 9);
			break;
		case 10:
			MD2PADDING = new Array(10, 10, 10, 10, 10, 10, 10, 10, 10, 10);
			break;
		case 11:
			MD2PADDING = new Array(11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11);
			break;
		case 12:
			MD2PADDING = new Array(12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12);
			break;
		case 13:
			MD2PADDING = new Array(13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13);
			break;
		case 14:
			MD2PADDING = new Array(14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14);
			break;
		case 15:
			MD2PADDING = new Array(15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15);
			break;
		case 16:
			MD2PADDING = new Array(16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16);
			break;
		default:
			break;
	}
	MD2Update(MD2PADDING, padLen);

	MD2Update(MD2contextChecksum, 16);

	MD2Memcpy(MD2digest, 0, MD2contextState, 0, 16);

	for (j = 0; j < 16; j++) {
		MD2contextState[j] = 0;
		MD2contextChecksum[j] = 0;
		MD2contextBuffer[j] = 0;
	}
	MD2contextCount = 0;
}

function MD2Transform(state, checksum, block, bIndex) {
	var x = new Array(48);
	var i;
	var j;
	var t;

	MD2Memcpy(x, 0, state, 0, 16);
	MD2Memcpy(x, 16, block, bIndex, 16);
	for (i = 0; i < 16; i++) {
		x[32 + i] = state[i] ^ block[i + bIndex];
	}
	t = 0;

	for (i = 0; i < 18; i++) {
		for (j = 0; j < 48; j++) {
			t = x[j] ^= MD2PI_SUBST[t];
		}
		t = (t + i) & 0xff;

	}

	MD2Memcpy(state, 0, x, 0, 16);

	t = checksum[15];
	for (i = 0; i < 16; i++) {
		t = checksum[i] ^= MD2PI_SUBST[block[i + bIndex] ^ t];
	}

	for (i = 0; i < 48; i++) {
		x[i] = 0;
	}
}

function MD2Memcpy(x, iti1, input, iti2, len) {
	var i;
	for (i = 0; i < len; i++) {
		x[iti1 + i] = input[iti2 + i];
	}
}

