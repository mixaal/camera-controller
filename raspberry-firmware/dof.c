#include <stdio.h>
#include <stdlib.h>

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

  printf("H=%fmm near=%fmm far=%fmm\n", H, near, far);
  return 0;
}
