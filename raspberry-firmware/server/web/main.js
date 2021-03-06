const COLOR_MAX = 255;
const COLOR_MID = 128;
const EPSILON = 1e-6;
const GIMP_TRANSFER_SHADOWS = 0;
const GIMP_TRANSFER_MIDTONES = 1;
const GIMP_TRANSFER_HIGHLIGHTS = 2;

const NORMAL_MODE = 0;
const SCREEN_MODE = 1;

function to_gray(r, g, b) {
    return 0.3*r + 0.6*g + 0.1*b;
}

function maxf(a, b, c) {
    return Math.max(Math.max(a, b), c);
}

function minf(a, b, c) {
    return Math.min(Math.min(a, b), c);
}

function fabs(x) {
    if(x>=0) return x;
    return -x;
}

function contrast(data, c) {
    c = Number(c)
    dx = c + COLOR_MAX;
    dy = 259.0 - c;
    Fx = 259.0 * dx;
    Fy = COLOR_MAX * dy;
    F = Fx / Fy;
    for (var i = 0; i < data.length; i += 4) {
        r = data[i] - COLOR_MID;
        g = data[i+1] - COLOR_MID;
        b = data[i+2] - COLOR_MID;

        r *= F;
        g *= F;
        b *= F;

        r += COLOR_MID;
        g += COLOR_MID;
        b += COLOR_MID;
        if (r<0) r = 0;
        if (g<0) g = 0;
        if (b<0) b = 0;
        if (r > COLOR_MAX) r = COLOR_MAX;
        if (g > COLOR_MAX) g = COLOR_MAX;
        if (b > COLOR_MAX) b = COLOR_MAX; 
        data[i]     = r;
        data[i + 1] = g;
        data[i + 2] = b;
    }
}

function exposure(data, e) {
    e = Number(e)
    p = Math.pow(2, e);
    for (var i = 0; i < data.length; i += 4) {
        r = data[i]  ;
        g = data[i+1];
        b = data[i+2];

        r *= p;
        g *= p;
        b *= p;

        if (r<0) r = 0;
        if (g<0) g = 0;
        if (b<0) b = 0;
        if (r > COLOR_MAX) r = COLOR_MAX;
        if (g > COLOR_MAX) g = COLOR_MAX;
        if (b > COLOR_MAX) b = COLOR_MAX; 
        data[i]     = r;
        data[i + 1] = g;
        data[i + 2] = b;
    }
}

function tint(data, temp) {
    
    for (var i = 0; i < data.length; i += 4) {
        g = data[i+1] - temp;
        if (g<0) g = 0;
        if (g > COLOR_MAX) g = COLOR_MAX;
        data[i + 1] = g;
    }
}

function adjust_saturation(data, scale) {
    scale = Number(scale);
    for (var i = 0; i < data.length; i += 4) {
        rgb = vec3_init(data[i]/COLOR_MAX, data[i+1]/COLOR_MAX, data[i+2]/COLOR_MAX);
        HSL = RGBtoHSL(rgb);
        HSL.g += scale;
        HSL.g = clamp(HSL.g, 0.0, 1.0);
        newRGB = HSLtoRGB(HSL);
        data[i] = COLOR_MAX * newRGB.r;
        data[i+1] = COLOR_MAX * newRGB.g;
        data[i+2] = COLOR_MAX * newRGB.b;
    }
}

function vibrance(data, scale, threshold, show_saturation) {
    scale = Number(scale);
    //alert("max="+max_saturation+" min="+min_saturation);
    for (var i = 0; i < data.length; i += 4) {
        rgb = vec3_init(data[i]/COLOR_MAX, data[i+1]/COLOR_MAX, data[i+2]/COLOR_MAX);
        HSL = RGBtoHSL(rgb);
        if(scale>0) {
            if(HSL.g > threshold) {
                delta = 1.0 - HSL.g; // distance to go
                HSL.g += scale * delta;
            }
        } else {
            HSL.g += scale;
        }
        HSL.g = clamp(HSL.g, 0.0, 1.0);
        if(show_saturation) {
            data[i] = data[i+1] = data[i+2] = COLOR_MAX * HSL.g;
        } else {
            newRGB = HSLtoRGB(HSL);
            data[i] = COLOR_MAX * newRGB.r;
            data[i+1] = COLOR_MAX * newRGB.g;
            data[i+2] = COLOR_MAX * newRGB.b;
        }
        
    }
}

function saturatef(a) {
    if(a<0) a=0.0;
    if(a>1.0) a = 1.0;
    return a;
}

function mix(a, b, k)
{
  return a + (b - a) * k;
}

function vec3_init(x, y, z) {
    return {
        r:x, g:y, b:z
    }
}

function vec3_add(a, b) {
    return {
        r: a.r + b.r,
        g: a.g + b.g,
        b: a.b + b.b
    }
}

function vec3_sub(a, b) {
    return {
        r: a.r - b.r,
        g: a.g - b.g,
        b: a.b - b.b
    }
}

function vec3_multiply(v, k) {
    return {
        r: v.r * k,
        g: v.g * k,
        b: v.b * k
    }
}

function vec3_mix(v, u, k) {
    return {
        r: mix(v.r, u.r, k),
        g: mix(v.g, u.g, k),
        b: mix(v.b, u.b, k)
    }
}

function vec3_clamp(v, minr, maxr)
{
  o = { r: clamp(v.r, minr, maxr), g: clamp(v.g, minr, maxr), b:clamp(v.b, minr, maxr) };
  return o;
}

function blend2(Ca, Cb, aa, ab)
{
  c_a = vec3_multiply(Ca, aa);
  c_b = vec3_multiply(Cb, ab);
  c_o = vec3_add(
    vec3_multiply(c_a, 1-ab), c_b
  );
//   ao = aa+ab*(1-aa);
//   v= vec3_multiply(c_o, 1.0/ao);
  //alert("ca="+c_a.r+" cb="+c_b.r+" aa="+aa+" ab="+ab+" ao="+ao+" co="+c_o.r);
  return c_o;
}

function gradient_map(data, start_color, end_color, weight, opacity) {
    weight = saturatef(weight)
    start_color = vec3_multiply(start_color, 1.0/COLOR_MAX);
    end_color = vec3_multiply(end_color, 1.0/COLOR_MAX);
    center_color = {
                    r: 0.5 * ( start_color.r +  end_color.r ),
                    g: 0.5 * ( start_color.g +  end_color.g ),
                    b: 0.5 * ( start_color.b +  end_color.b )
    };
    for (var i = 0; i < data.length; i += 4) {
        r = data[i]   / COLOR_MAX;
        g = data[i+1] / COLOR_MAX;
        b = data[i+2] / COLOR_MAX;

        Iv = to_gray(r, g, b);

        newRGB = {r:0, g:0, b:0};
        
        if (Iv < weight) {
            k = Iv / weight;
            
            newRGB =
               vec3_add(
                 vec3_multiply(vec3_mix(start_color, center_color, k), opacity) ,
                 vec3_multiply(vec3_init(r, g, b), 1 - opacity)
               );
          } else {
            k = (Iv - weight) / (1.0-weight);
            newRGB =
               vec3_add(
                 vec3_multiply(vec3_mix(center_color, end_color, k), opacity),
                 vec3_multiply(vec3_init(r, g, b), 1 - opacity)
               );
          }

        r = COLOR_MAX * newRGB.r;
        g = COLOR_MAX * newRGB.g;
        b = COLOR_MAX * newRGB.b;
        if (r > COLOR_MAX) r = COLOR_MAX;
        if (g > COLOR_MAX) g = COLOR_MAX;
        if (b > COLOR_MAX) b = COLOR_MAX;
        if (r<0) r=0;
        if (g<0) g=0;
        if (b<0) b=0;
        data[i]     = r;
        data[i + 1] = g;
        data[i + 2] = b;
    }
}

function clamp(x, minr, maxr) {
    if (x >= maxr ) return maxr;
    if (x <= minr ) return minr;
    return x;
}

// Borrowed from gimp:
//    https://github.com/GNOME/gimp/blob/master/app/operations/gimpoperationcolorbalance.c
function
gimp_operation_color_balance_map (value,
                                  lightness,
                                  shadows,
                                  midtones,
                                  highlights)
{
  /* Apply masks to the corrections for shadows, midtones and
   * highlights so that each correction affects only one range.
   * Those masks look like this:
   *     ‾\___
   *     _/‾\_
   *     ___/‾
   * with ramps of width a at x = b and x = 1 - b.
   *
   * The sum of these masks equals 1 for x in 0..1, so applying the
   * same correction in the shadows and in the midtones is equivalent
   * to applying this correction on a virtual shadows_and_midtones
   * range.
   */
  var a = 0.25, b = 0.333, scale = 0.7;

  shadows    *= clamp((lightness - b) / -a + 0.5, 0, 1) * scale;
  midtones   *= clamp ((lightness - b) /  a + 0.5, 0, 1) *
                clamp ((lightness + b - 1) / -a + 0.5, 0, 1) * scale;
  highlights *= clamp ((lightness + b - 1) /  a + 0.5, 0, 1) * scale;

  value += shadows;
  value += midtones;
  value += highlights;
  value = clamp(value, 0.0, 1.0);

  return value;
}



function HUEtoRGB(H)
{
    R = saturatef(fabs(H * 6.0 - 3.0) - 1.0);
    G = saturatef(2.0 - fabs(H * 6.0 - 2.0));
    B = saturatef(2.0 - fabs(H * 6.0 - 4.0));
    r = {r:R, g:G, b:B};
    return r;
}

function HSLtoRGB(HSL)
{
    RGB = HUEtoRGB(HSL.r);
    C = (1.0 - fabs(2.0 * HSL.b - 1.0)) * HSL.g;
    RGB.r -= 0.5;
    RGB.g -= 0.5;
    RGB.b -= 0.5;

    RGB.r *= C;
    RGB.g *= C;
    RGB.b *= C;

    RGB.r += HSL.b;
    RGB.g += HSL.b;
    RGB.b += HSL.b;

    return RGB;
}

function RGBtoHCV(RGB)
{
    // Based on work by Sam Hocevar and Emil Persson
    var Px, Py, Pz, Pw;
    var Qx, Qy, Qz, Qw;
    if (RGB.g < RGB.b) {
       Px = RGB.b;
       Py = RGB.g;
       Pz = -1.0;
       Pw = 2.0/3.0;
    } else {
       Px = RGB.g;
       Py = RGB.b;
       Pz = 0.0;
       Pw = -1.0/3.0;
    }
    if (RGB.r < Px) {
       Qx = Px;
       Qy = Py;
       Qz = Pw;
       Qw = RGB.r;
    } else {
       Qx = RGB.r;
       Qy = Py;
       Qz = Pz;
       Qw = Px;
    }
    C = Qx - Math.min(Qw, Qy);
    H = fabs((Qw - Qy) / (6.0 * C + EPSILON) + Qz);
    return vec3_init(H, C, Qx);
}

function RGBtoHSL(RGB)
{
    HCV = RGBtoHCV(RGB);
    L = HCV.b - HCV.g * 0.5;
    S = HCV.g / (1.0 - fabs(L * 2.0 - 1.0) + EPSILON);
    return vec3_init(HCV.r, S, L);
}



// Adjust color balance cyan-red, magenta-green, yellow-blue, -1,1
function adjust_color_balance(
    data,
    cyan_red_coef,
    magenta_green_coef,
    yellow_blue_coef,
    preserve_luminosity) {
    
  
    for(i=0; i<3; i++) {
      cyan_red_coef[i] = clamp(cyan_red_coef[i], -1 , 1);
      magenta_green_coef[i] = clamp(magenta_green_coef[i], -1, 1);
      yellow_blue_coef[i] = clamp(yellow_blue_coef[i], -1, 1);
      //fprintf(stderr, "cyan_red_coef=%f\nmagenta_green_coef=%f\nyellow_blue_coef=%f\n", cyan_red_coef[i], magenta_green_coef[i], yellow_blue_coef[i]);
    }

    for (var i = 0; i < data.length; i += 4) {
        r = data[i]   / COLOR_MAX;
        g = data[i+1] / COLOR_MAX;
        b = data[i+2] / COLOR_MAX;


        HSL = RGBtoHSL(vec3_init(r, g, b));

        r_n = gimp_operation_color_balance_map (r, HSL.b,
                                               cyan_red_coef[GIMP_TRANSFER_SHADOWS],
                                               cyan_red_coef[GIMP_TRANSFER_MIDTONES],
                                               cyan_red_coef[GIMP_TRANSFER_HIGHLIGHTS]);
 
        g_n = gimp_operation_color_balance_map (g, HSL.b,
                                               magenta_green_coef[GIMP_TRANSFER_SHADOWS],
                                               magenta_green_coef[GIMP_TRANSFER_MIDTONES],
                                               magenta_green_coef[GIMP_TRANSFER_HIGHLIGHTS]);
 
        b_n = gimp_operation_color_balance_map (b, HSL.b,
                                               yellow_blue_coef[GIMP_TRANSFER_SHADOWS],
                                               yellow_blue_coef[GIMP_TRANSFER_MIDTONES],
                                               yellow_blue_coef[GIMP_TRANSFER_HIGHLIGHTS]);
 
         if (preserve_luminosity)
         {
           rgb = vec3_init(r_n, g_n, b_n);
           hsl = RGBtoHSL(rgb);
 
           hsl.b = HSL.b;
 
           rgb = HSLtoRGB(hsl);
 
           r_n = rgb.r;
           g_n = rgb.g;
           b_n = rgb.b;
          }
 
          r = COLOR_MAX * r_n;
          g = COLOR_MAX * g_n;
          b = COLOR_MAX * b_n;
          if (r > COLOR_MAX) r = COLOR_MAX;
          if (g > COLOR_MAX) g = COLOR_MAX;
          if (b > COLOR_MAX) b = COLOR_MAX;
          if (r<0) r=0;
          if (g<0) g=0;
          if (b<0) b=0;
          data[i]     = r;
          data[i + 1] = g;
          data[i + 2] = b;
    }

}



function black_and_white(data) {
    for (var i = 0; i < data.length; i += 4) {
        r = data[i];
        g = data[i+1];
        b = data[i+2];
        data[i] = data[i+1] = data[i+2] = (r + g + b) / 3;
    }
}

function gauss_kernel(N, sigma=1.0) {
    var kernel = new Array(N);
    for(i=0; i<N;i++) {
        kernel[i] = new Array(N);
    }
    if (sigma==0.0) {
        sigma = N/6.0;
    }
    s = 2.0 * sigma * sigma; 
    maxval = 0;
    N2 = N>>1;
    var f_xy = 0;
    for(x=-N2; x<N2; x++) {
        for(y=-N2; y<N2; y++) {
            r = Math.sqrt(x * x + y * y); 
            if(r>N2) {
                f_xy = 0;
            } else {
                f_xy = (Math.exp(-(r * r) / s)) / (Math.PI * s);
            }
            kernel[x+N2][y+N2]  = f_xy;
            if(f_xy>maxval) {
                maxval = f_xy;
            }
        }
    }
    for(i=0; i<N; i++) {
        for(j=0; j<N; j++) {
            kernel[i][j]/=maxval;
        }
    }
    return kernel;
}

function blend_linear_light(a, b, a_opacity, b_opacity) 
{
    base = vec3_init(0.5, 0.5, 0.5);
    a_opacity = saturatef(a_opacity);
    b_opacity = saturatef(b_opacity);
    output = vec3_sub(vec3_add(a, vec3_multiply(b, 2.0)), base);
    //output = vec3_clamp(output, 0, COLOR_MAX);
    return blend2( output, b, a_opacity, b_opacity );  
}


function blend_addition(a, b, a_opacity, b_opacity) 
{
    a_opacity = saturatef(a_opacity);
    b_opacity = saturatef(b_opacity);
    output = vec3_add(a, b);
    //output = vec3_clamp(output, 0, COLOR_MAX);
    return blend2( output, b, a_opacity, b_opacity );  
}

function blend_normal(a,  b, a_opacity, b_opacity)
{
  a_opacity = saturatef(a_opacity);
  b_opacity = saturatef(b_opacity);
  return blend2( a, b, a_opacity, b_opacity );
}

function brush_stroke(data, width, mask, size, sigma, opacity, x, y, color, eraser=false) {
    N2 = size>>1;
    if(mask) {
        Iv = to_gray(color.r, color.g, color.b);
        color = {r: Iv, g: Iv, b: Iv};
    }
    kernel = gauss_kernel(size, sigma);
    for(i=-N2; i<N2; i++) {
        for(j=-N2; j<N2; j++) {
            xx = x+i;
            yy = y+j;
            if(xx<0) continue;
            if(yy<0) continue;
            if(xx>=width) continue;
            idx = 4 * (yy*width + xx);

            if (idx>=data.length) continue;
            g = kernel[i+N2][j+N2];
            a = g*opacity;
            if(eraser) {
                a_1 = 1.0;
                if(a!=0.0) {
                    a_1 = 1.0/(1.0-a);
                }
                // data[idx] =  a_1 * (data[idx] - color.r*a);
                // data[idx+1] =  a_1 * (data[idx+1] - color.g*a);
                // data[idx+2] =  a_1 * (data[idx+2] - color.b*a);
                data[idx+3] =  a_1 * (data[idx+3] -  a);
            } else {
                data[idx] =  data[idx]*(1-a) + color.r*a;
                data[idx+1] =  data[idx+1]*(1-a) + color.g*a;
                data[idx+2] =  data[idx+2]*(1-a) + color.b*a;
                data[idx+3] = data[idx+3]*(1-a) + a;
            }
            if(data[idx] < 0) data[idx] = 0;
            if(data[idx+1] < 0) data[idx+1] = 0;
            if(data[idx+2] < 0) data[idx+2] = 0;
            if(data[idx+3] < 0) data[idx+3] = 0;
            if(data[idx] > COLOR_MAX) data[idx] = COLOR_MAX;
            if(data[idx+1] > COLOR_MAX) data[idx+1] = COLOR_MAX;
            if(data[idx+2] > COLOR_MAX) data[idx+2] = COLOR_MAX;
            if(data[idx+3] > 1) data[idx+3] = 1.0;
        }
    }
}


function rgbtext(color) {
    return "rgb("+color.r+","+color.g+","+color.b+")";
}

var Photoshop = VueColor.Photoshop

Vue.component('imageprocessor', {
    props: {
        source: {
            type: String,
            required: true,
            default: "canvas.jpg"
        }
    },
    components: {
        'photoshop-picker': Photoshop
    },
    template: `
    <div id="sketch">
        <button @click="save_profile">Save Profile</button>
        <button @click="load_profile">Load Profile</button>
        <table>
        <tr>
        <td>
        <canvas v-on:mousedown="handleMouseDown" v-on:mouseup="handleMouseUp" v-on:mousemove="handleMouseMove" ref="paint"></canvas>
        </td>
        <td class="panel">
        <button id="fg_color" v-bind:style="fgc" @click="toggleFgPicker">FG</button>
        <photoshop-picker v-if="foreground_color_picker_enabled" id="foreground_picker" v-model="settings.foreground_color" @ok="chooseFgColor" @cancel="toggleFgPicker"></photoshop-picker>

        <button id="fg_color" v-bind:style="bgc" @click="toggleBgPicker">BG</button>
        <photoshop-picker v-if="background_color_picker_enabled" id="background_picker" v-model="settings.background_color" @ok="chooseBgColor" @cancel="toggleBgPicker"></photoshop-picker>
        <br/>
        <p class="group">
        
        <table>
        <tr>
        <td class="mainpanel">
        Brush Settings
        </td>
        <td>
        <button v-on:click="clear_brush_canvas">Clear</button>
        </td>
        <td>
        <select v-model="settings.brush.layer_mode">
            <option v-for="option in settings.brush.modes" v-bind:value="option.value">
            {{ option.text }}
            </option>
        </select>
        </td>
        <td align="right">
        <label class="switch">
        <input type="checkbox" checked v-model="settings.brush.lock">
        <span class="swslider round"></span>
        </label>
        </td>
        <td>Hide</td>
        <td>Brush</td>
        <td>
        <label class="switch">
        <input type="checkbox" v-model="settings.brush.eraser">
        <span class="swslider round"></span>
        </label>
        </td>
        <td>Eraser</td>
        </tr>
        </table>
        <table>
        <tr>
        <td>Size</td>
        <td class="mainpanel"><input type="range" min="1" max="1001" value="31" step="2" class="slider"  v-model="settings.brush.size" ></td>
        <td>{{settings.brush.size}}</td>
        </tr>
        <tr>
        <td>Opacity</td>
        <td class="mainpanel"><input type="range" min="0" max="1.0" value="1.0" step="0.01" class="slider"  v-model="settings.brush.opacity" ></td>
        <td>{{settings.brush.opacity}}</td>
        </tr>
        </table>
        </p>
        <button v-on:click="reset_settings">Reset All</button>
        <br/>
        <p class="group">
        Vibrance 
        <input type="range" min="-1.0" max="1.0" value="0" step="0.01" class="slider" id="vibrance_scale" v-model="settings.vibrance_scale" >
        {{settings.vibrance_scale}}
        <input type="range" min="0.0" max="1.0" value="0" step="0.01" class="slider" id="vibrance_treshold" v-model="settings.vibrance_treshold" >
        {{settings.vibrance_treshold}}
        <button @click="settings.vibrance_scale=0.0">Reset</button>
        <label class="switch">
        <input type="checkbox" v-model="settings.show_vibrance">
        <span class="swslider round"></span>
        </label>Show saturation
        </p>
        <br/>

        <p class="group">
        Contrast
        <input type="range" min="-128" max="128" value="0" step="1" class="slider" id="contrast_scale" v-model="settings.contrast_scale" >
        {{settings.contrast_scale}}
        <button @click="settings.contrast_scale=0.0">Reset</button>
        </p>
        <br/>

        <p class="group">
        Exposure
        <input type="range" min="-3.5" max="3.5" value="0" step="0.01" class="slider" id="exposure_slider" v-model="settings.exposure_scale" >
        {{settings.exposure_scale}}
        <button @click="settings.exposure_scale=0.0">Reset</button>
        </p>
        <br/>

        
        <p class="group">
        Tint
        <input type="range" min="-20" max="20" value="0" step="1" class="slider" id="tint_slider" v-model="settings.tint_scale" >
        {{settings.tint_scale}}
        <button @click="settings.tint_scale=0.0">Reset</button>
        </p>
        <br/>

        <p class="group">
        Gradient Map
        <table>
        <tr>
        <td>Weight</td>
        <td class="mainpanel"><input type="range" min="0.0" max="1.0" value="0.5" step="0.02" class="slider" id="gradient_map_weight" v-bind:style="gmap_gradient" v-model="settings.gmap.weight" ></td>
        <td>{{settings.gmap.weight}}</td>
        </tr>
        <tr>
        <td>Opacity</td>
        <td class="mainpanel"><input type="range" min="0.0" max="1.0" value="0.0" step="0.02" class="slider" id="gradient_map_opacity" v-model="settings.gmap.opacity" ></td>
        <td>{{settings.gmap.opacity}}</td>
        </tr>
        </table>
        
        <table>
        <tr>
        
        <td>
        <button @click="reset_gmap">Reset</button>
        </td>

        <td align="right">
        <label class="switch">
        <input type="checkbox" checked v-model="settings.gmap.lock">
        <span class="swslider round"></span>
        </label>
        </td>

        <td>Lock</td>
        </tr>
        </table>
        </p>
        <p class="group">
        Tone Map <br/>
        <input type="checkbox" id="checkbox" v-model="settings.tone_preserve_luminosity">Preserve luminosity
        <input type="radio" name="levels" value="0"  @click="color_tone_settings(0)">Shadows</input>
        <input type="radio" name="levels" value="1"  @click="color_tone_settings(1)" checked>Midtones</input>
        <input type="radio" name="levels" value="2"  @click="color_tone_settings(2)">Highlights</input>
        <table>
        <tr>
        <td>cyan</td>
        <td class="mainpanel">
        <input type="range" min="-1.0" max="1.0" value="0" step="0.01" class="slider"  id="color_cyan_red" v-model="settings.tone_cyan_red" @change="color_tone_move">
        </td>
        <td>red</td>
        </tr>
        <tr>
        <td>magenta</td>
        <td class="mainpanel">
        <input type="range" min="-1.0" max="1.0" value="0" step="0.01" class="slider"  id="color_magenta_green" v-model="settings.tone_magenta_green" @change="color_tone_move">
        </td>
        <td>green</td>
        </tr>
        <tr>
        <td>yellow</td>
        <td class="mainpanel">
        <input type="range" min="-1.0" max="1.0" value="0" step="0.1" class="slider"  id="color_yellow_blue" v-model="settings.tone_yellow_blue" @change="color_tone_move">
        </td>
        <td>
        blue
        </td>
        </tr>
        </table>
        <button @click="reset_color_tone">Reset</button>
        </p>
        </td>
        </td>
        </tr>
        </table>
    </div>
    `,
    data () {
        return {
            currentRandom: 0,
            mounted: false,
            timer: '',
            
            settings: {
                canvas_width: 0,
                canvas_height: 0,
                foreground_color: { r: 255, g: 255, b: 255, rgba: {r: 255, g: 255, b:255} },
                background_color: { r: 0, g: 0, b: 0, rgba: {r:0, g:0, b:0} },
                vibrance_scale: 0.0,
                vibrance_treshold: 0.0,
                show_vibrance: false,
                contrast_scale: 0.0,
                exposure_scale: 0.0,
                tint_scale: 0.0,
                gmap: {
                    weight: 0.5,
                    opacity: 0.0,
                    lock: false,
                    fg: {r:255, g:255, b:255},
                    bg: {r:0, g:0, b:0}
                },
                tone_cyan_red: 0.0,
                tone_magenta_green: 0.0,
                tone_yellow_blue: 0.0,

                highlights: {
                    cyan_red: 0.0,
                    magenta_green: 0.0,
                    yellow_blue: 0.0
                },
                midtones: {
                    cyan_red: 0.0,
                    magenta_green: 0.0,
                    yellow_blue: 0.0
                },
                shadows: {
                    cyan_red: 0.0,
                    magenta_green: 0.0,
                    yellow_blue: 0.0
                },
            
                tone_levels: 1,
                brush: {
                    opacity: 0.5,
                    size: 401,
                    sigma: 0.0,
                    lock: false,
                    eraser: false,
                    layer_mode: "normal",
                    modes: [
                        {text: "Normal", value: "normal"},
                        {text: "Addition", value: "addition"},
                        {text: "Linear light", value: "linear"}
                    ]
                },
                history: [],
                image_loaded: false
            },
            to_draw: [],
            layers: {
                stack:[],
                top: 0
            },
            foreground_color_picker_enabled: false,
            background_color_picker_enabled: false,
            bgc: {
                backgroundColor: '#000000'
            },
            fgc: {
                backgroundColor: '#ffffff'
            },
            gmap_gradient: {
                background: 'linear-gradient(to right, rgb(0,0,0) , rgb(255,255,255) )'
            }
        }
    },
    created () {
        this.mounted = false;
        this.create_layers(20);
        this.paint();
        this.timer = setInterval(this.paint, 300);
    },
    mounted () {
        this.mounted = true;
    },
    methods: {
        save_profile() {
            profile_name = prompt("Profile name");
            http = new XMLHttpRequest()
            http.open('POST', "/profiles/save", true);
            http.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
            profile={name: profile_name, settings: this.settings};
            http.send(JSON.stringify(profile));
            http.onerror = function() { // only triggers if the request couldn't be made at all
                alert(`Network Error`);
            };
            http.onloadend = function() {
                if(http.status != 200) {
                    alert('server replied: '+http.status);
                    return;
                }
            }
        },
        load_profile() {
            profile_name = prompt("Profile name");
            http = new XMLHttpRequest()
            http.open('POST', "/profiles/load", true);
            http.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
            profile={name: profile_name};
            http.send(JSON.stringify(profile));
            http.onerror = function() { // only triggers if the request couldn't be made at all
                alert(`Network Error`);
            };
            var _that = this;
            http.onloadend = function() {
                if(http.status != 200) {
                    alert('server replied: '+http.status);
                    return;
                }
                _that.clear_brush_canvas();
                profile = JSON.parse(http.response);
                //console.log("XXX"+JSON.stringify(_that.settings));
                _that.settings = profile.settings;
                _that.to_draw = profile.settings.history.slice();
                if(!profile.settings.foreground_color.hasOwnProperty("hex")) {
                    profile.settings.foreground_color.hex = "#FFFFFF";
                }
                if(!profile.settings.background_color.hasOwnProperty("hex")) {
                    profile.settings.background_color.hex = "#000000";
                }
                _that.fgc.backgroundColor = profile.settings.foreground_color.hex;
                _that.bgc.backgroundColor = profile.settings.background_color.hex;
                
                _that.set_gmap_bg();
                _that.set_gmap_fg();
                //console.log("YYY"+JSON.stringify(_that.settings));
            }
        },
        get_brush_data() {
            return this.layers.stack[0].data;
        },
        clear_brush_canvas() {
            brush_data = this.get_brush_data();
            for(i=0; i<brush_data.length; i++) {
                brush_data[i] = 0;
            }
            var filtered = this.settings.history.filter(function(el, index, arr){
                return (el.type!="brush_stroke" && el.type!="eraser");
            
            });
            this.settings.history = filtered;
        },
        create_layers(N) {
            for (i=0; i<N; i++) {
                this.layers.stack = new Array(N);
            }
        },
        create_new_layer(data_length) {
            this.layers.stack[this.layers.top] = {
                data: new Array(data_length),
                mask: new Array(data_length),
                mode: NORMAL_MODE
            }
            for(i=0; i<data_length; i+=4) {
                this.layers.stack[this.layers.top].data[i]=0;
                this.layers.stack[this.layers.top].data[i+1]=0;
                this.layers.stack[this.layers.top].data[i+2]=0;
                this.layers.stack[this.layers.top].data[i+3]=0;
            }
            this.layers.top ++;
        },
        merge_layers(data) {
            
            //FIXME TODO
        },
        set_gmap_fg() {
            if(!this.settings.gmap.lock) {
                this.settings.gmap.fg = this.settings.foreground_color;
                this.settings.gmap.bg = this.settings.background_color;
                this.gmap_style();
            }
        },
        set_gmap_bg() {
            if(!this.settings.gmap.lock) {
                this.settings.gmap.fg = this.settings.foreground_color;
                this.settings.gmap.bg = this.settings.background_color;
                this.gmap_style();
            }
        },
        chooseFgColor() {
            this.toggleFgPicker();
            this.fgc.backgroundColor = this.settings.foreground_color.hex;
            if(!this.settings.foreground_color.hasOwnProperty("rgba")) {
                this.settings.foreground_color.rgba = {r: COLOR_MAX, g: COLOR_MAX, b:COLOR_MAX};
                this.settings.hex = "#FFFFFF";
            }
            this.settings.foreground_color.r = this.settings.foreground_color.rgba.r;
            this.settings.foreground_color.g = this.settings.foreground_color.rgba.g;
            this.settings.foreground_color.b = this.settings.foreground_color.rgba.b;

            this.set_gmap_fg();
        },
        chooseBgColor() {
            this.toggleBgPicker();
            this.bgc.backgroundColor = this.settings.background_color.hex;
            if(!this.settings.background_color.hasOwnProperty("rgba")) {
                this.settings.background_color.rgba = {
                    r: 0, g: 0, b:0
                };
                this.settings.hex = "#000000";
            }
            this.settings.background_color.r = this.settings.background_color.rgba.r;
            this.settings.background_color.g = this.settings.background_color.rgba.g;
            this.settings.background_color.b = this.settings.background_color.rgba.b;
            this.set_gmap_bg();
        },
        gmap_style() {
            sb = rgbtext(this.settings.gmap.bg);
            sf = rgbtext(this.settings.gmap.fg);
            str = 'linear-gradient(to right, '+sb+' ,'+sf+' )';
            this.gmap_gradient.background = str;
        },
        toggleFgPicker() {
            this.foreground_color_picker_enabled = !this.foreground_color_picker_enabled;
        },
        toggleBgPicker() {
            this.background_color_picker_enabled = !this.background_color_picker_enabled;
        },
        image_src() {
            return this.source+"?random="+this.currentRandom
        },
        reset_gmap() {
            this.settings.gmap.weight=0.5;
            this.settings.gmap.opacity= 0.0;
            this.settings.gmap.lock=false;
            this.settings.gmap.fg={r:255, g:255, b:255};
            this.settings.gmap.bg={r:0, g:0, b:0};
            this.gmap_style();
        },
        reset_color_tone() {
            this.settings.highlights.cyan_red = 0.0;
            this.settings.highlights.magenta_green = 0.0;
            this.settings.highlights.yellow_blue = 0.0;
            this.settings.midtones.cyan_red = 0.0;
            this.settings.midtones.magenta_green = 0.0;
            this.settings.midtones.yellow_blue = 0.0;
            this.settings.shadows.cyan_red = 0.0;
            this.settings.shadows.magenta_green = 0.0;
            this.settings.shadows.yellow_blue = 0.0;
            this.settings.tone_cyan_red = 0.0;
            this.settings.tone_magenta_green = 0.0;
            this.settings.tone_yellow_blue = 0.0;
            this.settings.tone_levels = 1;
            this.settings.tone_preserve_luminosity = false;
        },
        color_tone_move() {
            console.log(this.settings);
            switch (this.settings.tone_levels) {
                case 2:
                    this.settings.highlights.cyan_red = this.settings.tone_cyan_red;
                    this.settings.highlights.magenta_green = this.settings.tone_magenta_green;
                    this.settings.highlights.yellow_blue = this.settings.tone_yellow_blue;
                    break;
                case 1:
                    this.settings.midtones.cyan_red = this.settings.tone_cyan_red;
                    this.settings.midtones.magenta_green = this.settings.tone_magenta_green;
                    this.settings.midtones.yellow_blue = this.settings.tone_yellow_blue;
                    break;
                case 0:
                    this.settings.shadows.cyan_red = this.settings.tone_cyan_red;
                    this.settings.shadows.magenta_green = this.settings.tone_magenta_green;
                    this.settings.shadows.yellow_blue = this.settings.tone_yellow_blue;
                    break;
            }
        },

        color_tone_settings(c) {
            this.settings.tone_levels = c;
            //alert(this.tone_levels);
            switch(this.settings.tone_levels) {
                case 2:
                    this.settings.tone_cyan_red = this.settings.highlights.cyan_red;
                    this.settings.tone_magenta_green = this.settings.highlights.magenta_green;
                    this.settings.tone_yellow_blue = this.settings.highlights.yellow_blue;
                    break;
                case 1:
                    this.settings.tone_cyan_red = this.settings.midtones.cyan_red;
                    this.settings.tone_magenta_green = this.settings.midtones.magenta_green;
                    this.settings.tone_yellow_blue = this.settings.midtones.yellow_blue;
                    break;
                case 0:
                    this.settings.tone_cyan_red = this.settings.shadows.cyan_red;
                    this.settings.tone_magenta_green = this.settings.shadows.magenta_green;
                    this.settings.tone_yellow_blue = this.settings.shadows.yellow_blue;
                    break;
                default:
                    alert("Set one of shadows, midtones or highlights to slide!");
            }
        },

        reset_settings() {
            this.settings.exposure_scale = 0.0;
            this.settings.contrast_scale = 0.0;
            this.settings.vibrance_scale = 0.0;
            this.settings.vibrance_treshold = 0.0;
            this.settings.show_vibrance = false;
            this.settings.tint_scale = 0.0;
            this.reset_color_tone();
            this.reset_gmap();
        },

        handleMouseDown(e) {

        },

        handleMouseUp(e) {
            //if(!this.mounted) return;
            //const left = this.$refs.paint.getBoundingClientRect().left
            //const top = this.$refs.paint.getBoundingClientRect().top
            stroke = {
                type: "brush_stroke", 
                x: e.offsetX, y: e.offsetY, 
                size:this.settings.brush.size, 
                opacity:this.settings.brush.opacity,
                sigma:this.settings.brush.sigma,
                color:this.settings.foreground_color
            };
            if(this.settings.brush.eraser) {
                stroke.type = "eraser";
            }
            this.settings.history.push(stroke);
            this.to_draw.push(stroke);
        },

        handleMouseMove(e) {

        },

        set_canvas_dim(w, h) {
            this.settings.width = w;
            this.settings.height = h;
        },

        set_image_loaded() {
            this.settings.image_loaded = true;
        },
        
        paint() {
            if (!this.mounted) return;
            this.currentRandom = Math.random();
            var canvas = this.$refs.paint;
            var ctx = canvas.getContext('2d');
        
            var img = new Image();
            var settings = this.settings;
            var to_draw = this.to_draw;

            var _that = this;

            //brush_stroke(data, width, false, settings.brush.size, settings.brush.sigma, settings.brush.opacity, mouse_x, mouse_y, settings.foreground_color, blend_normal);
            img.onload=function() {
                _that.set_canvas_dim(img.width, img.height);
                
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                var image = ctx.getImageData(0, 0, canvas.width, canvas.height);
                var data = image.data;

                if(!settings.image_loaded) {
                    //alert("Allocate brush layer");
                    _that.create_new_layer(data.length);
                    _that.set_image_loaded();
                }
                
                var width = canvas.width;

                if (settings.gmap.opacity > 0) {
                    gradient_map(data, settings.gmap.bg, settings.gmap.fg, settings.gmap.weight, settings.gmap.opacity);
                }

                var cyan_red_coef = new Array();
                var magenta_green_coef = new Array();
                var yellow_blue_coef = new Array();
                cyan_red_coef[0] = settings.shadows.cyan_red;
                cyan_red_coef[1] = settings.midtones.cyan_red;
                cyan_red_coef[2] = settings.highlights.cyan_red;
                magenta_green_coef[0] = settings.shadows.magenta_green;
                magenta_green_coef[1] = settings.midtones.magenta_green;
                magenta_green_coef[2] = settings.highlights.magenta_green;
                yellow_blue_coef[0] = settings.shadows.yellow_blue;
                yellow_blue_coef[1] = settings.midtones.yellow_blue;
                yellow_blue_coef[2] = settings.highlights.yellow_blue;
                //console.log(settings);
                adjust_color_balance(data, cyan_red_coef, magenta_green_coef, yellow_blue_coef, settings.preserve_luminosity);

                if(settings.vibrance_scale<-0.01 || settings.vibrance_scale>0.01 || settings.show_vibrance) {
                    vibrance(data, settings.vibrance_scale, settings.vibrance_treshold, settings.show_vibrance);
                }
                if (settings.contrast_scale<0 || settings.contrast_scale > 0) {
                    contrast(data, settings.contrast_scale);
                }
                if (settings.exposure_scale<-0.01 || settings.exposure_scale>0.01) {
                    exposure(data, settings.exposure_scale);
                }
                if (settings.tint_scale<0 || settings.tint_scale>0) {
                    tint(data, settings.tint_scale);
                }

                brush_data = _that.get_brush_data();

                if(!settings.brush.lock) {
                    while(to_draw.length>0) {
                        el = to_draw.shift();
                        switch (el.type) {
                            case "brush_stroke":
                                brush_stroke(brush_data, width, false, el.size, el.sigma, el.opacity, el.x, el.y, el.color, false);
                                break;
                            case "eraser":
                                brush_stroke(brush_data, width, false, el.size, el.sigma, el.opacity, el.x, el.y, el.color, true);           
                                break;
                        }
                    }
                }

                // merge brush layer with image
                var output = {r:0, g:0, b:0};
                if(!settings.brush.lock) {
                    for(i=0; i<data.length; i+=4) {
                        switch(settings.brush.layer_mode) {
                            case "linear":
                                output = blend_linear_light(
                                    {r: data[i], g: data[i+1], b: data[i+2]},
                                    {r: brush_data[i], g: brush_data[i+1], b: brush_data[i+2]},
                                    1.0,
                                    brush_data[i+3]
                                );
                                break;
                            case "addition":
                                output = blend_addition(
                                    {r: data[i], g: data[i+1], b: data[i+2]},
                                    {r: brush_data[i], g: brush_data[i+1], b: brush_data[i+2]},
                                    1.0,
                                    brush_data[i+3]
                                    );
                                break;
                            case "normal":
                            default:
                                output = blend_normal(
                                    {r: data[i], g: data[i+1], b: data[i+2]},
                                    {r: brush_data[i], g: brush_data[i+1], b: brush_data[i+2]},
                                    1.0,
                                    brush_data[i+3]
                                );
                            
                                break;
                        }
                        
                        if(output.r>COLOR_MAX) output.r = COLOR_MAX;
                        if(output.g>COLOR_MAX) output.g = COLOR_MAX;
                        if(output.b>COLOR_MAX) output.b = COLOR_MAX;
                        data[i] = output.r;
                        data[i+1] = output.g;
                        data[i+2] = output.b;
                        
                    }
                }
                

                //black_and_white(data);
                ctx.putImageData(image, 0, 0);
            }
            //img.crossOrigin = "anonymous";
            img.src = this.image_src();


        }    
    },
    beforeDestroy () {
        clearInterval(this.timer)
    }
}
)


Vue.component('capture', {
    props: {
        source: {
            type: String,
            required: true,
            default: "liveview.jpg"
        }
    },
    template: `
    <div>
    <img :src="image" />
    </div>
    `,
    computed: {
        image() {
            return this.source+"?random="+this.currentRandom
        }
    },
    data () {
        return {
            currentRandom: 0,
            timer: ''
        }
    },
    created () {
        this.fetchEventsList();
        this.timer = setInterval(this.fetchEventsList, 300)
    },
    methods: {
        
        fetchEventsList () {
                this.currentRandom = Math.random()
            
        },
        cancelAutoUpdate () { clearInterval(this.timer) }

    },
    beforeDestroy () {
      clearInterval(this.timer)
    }
});

Vue.component('toggle-button', {
    props: {
        text: {
            type: String,
            required: true,
            default: "Toggle"
        },
        onuri: {
            type: String,
            required: true,
            default: ""
        },
        offuri: {
            type: String,
            required: true,
            default: ""
        },
        onstart: {
            type: Boolean,
            required: true,
            default: false
        }
    },
    template: `
    <div>
    <button v-on:click="toggleButton">
    <p v-if="this.liveViewEnabled">
        {{ text }} (on)
    </p>
    <p v-else="this.liveViewEnabled">
        {{ text }} (off)
    </p>
    </button>
    </div>
    `,
    
    data () {
        return {
            liveViewEnabled: this.onstart,
            _uriOn: this.onuri,
            _uriOff: this.offuri
        }
    },
    created () {
        this.liveViewEnabled = this.onstart
    },
    methods: {
        toggleButton: function () {
            http = new XMLHttpRequest()
            if(this.liveViewEnabled) {
                this.liveViewEnabled = false
                http.open('POST', this.offuri)
                http.send()
            } else {
                this.liveViewEnabled = true
                http.open('POST', this.onuri)
                http.send()
            }
        },
      

    },
    beforeDestroy () {
      
    }
});


var app = new Vue({
    el: '#app',
    data: {
        liveViewImage: 'liveview.jpg'
    }
})
