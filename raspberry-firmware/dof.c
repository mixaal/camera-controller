#include <stdio.h>
#include <stdlib.h>

float optimum_distance(float focal_length_mm, float real_object_height_mm, float image_height_px, float object_height_px, float sensor_height_mm)
{
  return (focal_length_mm * real_object_height_mm * image_height_px) / (object_height_px * sensor_height_mm);
}

float hyperfocal_distance(float coc, float focal_length_mm, float aperture)
{
  float f = focal_length_mm;
  return (f*f)/(aperture*coc) + f;
}

float near_distance(float focus_distance, float hyperfocal_distance, float focal_length_mm)
{
  return focus_distance * (hyperfocal_distance - focal_length_mm) / (hyperfocal_distance + focus_distance - 2*focal_length_mm);
}

float far_distance(float focus_distance, float hyperfocal_distance, float focal_length_mm) 
{
  return  focus_distance * (hyperfocal_distance - focal_length_mm) / (hyperfocal_distance - focus_distance);
}

void get_focus_distances(float aperture, float focal_length_mm, float coc)
{
  float min_focal_dist = 400;
  float H = hyperfocal_distance(coc, focal_length_mm, aperture);
  float focal_distance_inf = -1;
  float near_so_far = -1.0f;
  for(float focal_distance = 400; focal_distance < 1000000; focal_distance+=20) {
    float far  =far_distance(focal_distance, H, focal_length_mm);
    if (far<0) {
      /**
       * Find focal distance where the image is sharp to infinity.
       */
       
      focal_distance_inf = focal_distance;
      while (1) {
        far  =far_distance(focal_distance, H, focal_length_mm); 
        if (far>0) break;
        //printf("focal_distance=%.2fmm far=%.2fmm\n", focal_distance, far);
        focal_distance -= 2;
      }
      focal_distance += 2;
      focal_distance_inf = focal_distance;
      far  =far_distance(focal_distance, H, focal_length_mm);
      float near =near_distance(focal_distance, H, focal_length_mm);
      near_so_far = near;
      //printf("focal_distance=%.2fmm near=%.2fmm far=%.2fmm\n", focal_distance, near, far);
      break;	
    }
  }
  if(focal_distance_inf<0) return; // didn't find anything
  for(float focal_distance = focal_distance_inf; focal_distance > min_focal_dist; focal_distance-=2) {
    float far  =far_distance(focal_distance, H, focal_length_mm);
    float near =near_distance(focal_distance, H, focal_length_mm);
    float dof = (far>near) ? far-near : 0.0f;
    if(far<near_so_far) {
       near_so_far = near;
       printf("focal_distance=%.2fmm near=%.2fmm far=%.2fmm dof=%.2fmm\n", focal_distance, near, far, dof);
    }
  }
}

// https://www.dofmaster.com/digital_coc.html
#define CANON_FF_COC 0.03f
#define CANON_APSC_COC 0.019f
#define CANON_APSH_COC 0.023f

#define DEFAULT_FOCAL_DISTANCE_MM 3000 // 3m
#define DEFAULT_FOCAL_LENGTH_MM 85     // 85mm lens
#define DEFAULT_APERTURE        2.8f   // f-stop

int main(int argc, char *argv[])
{
  float focal_distance = DEFAULT_FOCAL_DISTANCE_MM;
  float aperture = DEFAULT_APERTURE;
  float focal_length = DEFAULT_FOCAL_LENGTH_MM;
  if(argc>1) aperture = atof(argv[1]);
  if(argc>2) focal_length = atof(argv[2]);
  if(argc>3) focal_distance = atof(argv[3]);
  printf("Configuration: aperture=%f focal_length=%.2f focal_distance=%.2f\n", aperture, focal_length, focal_distance);
  float H = hyperfocal_distance(CANON_FF_COC, focal_length, aperture);
  float near =near_distance(focal_distance, H, focal_length);
  float far  =far_distance(focal_distance, H, focal_length);

  printf("H=%fmm near=%fmm far=%fmm\n\n\n", H, near, far);
  get_focus_distances(aperture, focal_length, CANON_FF_COC);
  printf("distance=%.2f\n", optimum_distance(focal_length /*mm*/, 1500 /* mm */, 3700 /*px*/, 3200 /*px*/, 24 /*mm*/));
  return 0;
}
