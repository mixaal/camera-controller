#ifndef __LIB_CAMCTRL_H__
#define __LIB_CAMCTRL_H__ 1

int
camera_eosviewfinder(int onoff) ;
void capture_image(void);
int init_camera(void);
void exit_camera(void);

#endif /* __LIB_CAMCTRL_H__ */
