#include <stdlib.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdarg.h>
#include <string.h>
#include <unistd.h>
#include <gphoto2/gphoto2.h>

typedef struct {
	Camera	*camera;
	GPContext *context ;
	_Bool logger_installed;
} GPParams ;

static GPParams ctx;

static void errordumper(GPLogLevel level, const char *domain, const char *str,
                 void *data) {
  printf("%s (data %p)\n", str,data);
}

static void
ctx_error_func (GPContext *context, const char *str, void *data)
{
        fprintf  (stderr, "\n*** Contexterror ***              \n%s\n",str);
        fflush   (stderr);
}

static void
ctx_status_func (GPContext *context, const char *str, void *data)
{
        fprintf  (stderr, "%s\n", str);
        fflush   (stderr);
}

static int
_lookup_widget(CameraWidget*widget, const char *key, CameraWidget **child) 
{
	int ret;
	ret = gp_widget_get_child_by_name (widget, key, child);
	if (ret < GP_OK)
		ret = gp_widget_get_child_by_label (widget, key, child);
	return ret;
}

/* calls the Nikon DSLR or Canon DSLR autofocus method. */
int
camera_eosviewfinder(int onoff) 
{
	Camera *camera = ctx.camera;
	GPContext *context = ctx.context;
	CameraWidget		*widget = NULL, *child = NULL;
	CameraWidgetType	type;
	int			ret,val;

	ret = gp_camera_get_config (camera, &widget, context);
	if (ret < GP_OK) {
		fprintf (stderr, "camera_get_config failed: %d\n", ret);
		return ret;
	}
	ret = _lookup_widget (widget, "eosviewfinder", &child);
	if (ret < GP_OK) {
		fprintf (stderr, "lookup 'eosviewfinder' failed: %d\n", ret);
	        ret = _lookup_widget (widget, "viewfinder", &child);
	        if (ret < GP_OK) {
		  fprintf (stderr, "lookup 'viewfinder' failed: %d\n", ret);
   		  goto out;
		}
	}

	/* check that this is a toggle */
	ret = gp_widget_get_type (child, &type);
	if (ret < GP_OK) {
		fprintf (stderr, "widget get type failed: %d\n", ret);
		goto out;
	}
	switch (type) {
        case GP_WIDGET_TOGGLE:
		break;
	default:
		fprintf (stderr, "widget has bad type %d\n", type);
		ret = GP_ERROR_BAD_PARAMETERS;
		goto out;
	}

	ret = gp_widget_get_value (child, &val);
	if (ret < GP_OK) {
		fprintf (stderr, "could not get widget value: %d\n", ret);
		goto out;
	}
	val = onoff;
	ret = gp_widget_set_value (child, &val);
	if (ret < GP_OK) {
		fprintf (stderr, "could not set widget value to 1: %d\n", ret);
		goto out;
	}

	ret = gp_camera_set_config (camera, widget, context);
	if (ret < GP_OK) {
		fprintf (stderr, "could not set config tree to eosviewfinder: %d\n", ret);
		goto out;
	}
out:
	gp_widget_free (widget);
	return ret;
}

int
camera_auto_focus(Camera *camera, GPContext *context, int onoff) 
{
	CameraWidget		*widget = NULL, *child = NULL;
	CameraWidgetType	type;
	int			ret,val;

	ret = gp_camera_get_config (camera, &widget, context);
	if (ret < GP_OK) {
		fprintf (stderr, "camera_get_config failed: %d\n", ret);
		return ret;
	}
	ret = _lookup_widget (widget, "autofocusdrive", &child);
	if (ret < GP_OK) {
		fprintf (stderr, "lookup 'autofocusdrive' failed: %d\n", ret);
		goto out;
	}

	/* check that this is a toggle */
	ret = gp_widget_get_type (child, &type);
	if (ret < GP_OK) {
		fprintf (stderr, "widget get type failed: %d\n", ret);
		goto out;
	}
	switch (type) {
        case GP_WIDGET_TOGGLE:
		break;
	default:
		fprintf (stderr, "widget has bad type %d\n", type);
		ret = GP_ERROR_BAD_PARAMETERS;
		goto out;
	}

	ret = gp_widget_get_value (child, &val);
	if (ret < GP_OK) {
		fprintf (stderr, "could not get widget value: %d\n", ret);
		goto out;
	}

	val = onoff;

	ret = gp_widget_set_value (child, &val);
	if (ret < GP_OK) {
		fprintf (stderr, "could not set widget value to 1: %d\n", ret);
		goto out;
	}

	ret = gp_camera_set_config (camera, widget, context);
	if (ret < GP_OK) {
		fprintf (stderr, "could not set config tree to autofocus: %d\n", ret);
		goto out;
	}
out:
	gp_widget_free (widget);
	return ret;
}



static int
_find_widget_by_name (GPParams *p, const char *name, CameraWidget **child, CameraWidget **rootconfig) 
{
	int	ret;

	*rootconfig = NULL;
	ret = gp_camera_get_single_config (p->camera, name, child, p->context);
	if (ret == GP_OK) {
		*rootconfig = *child;
		return GP_OK;
	}

	ret = gp_camera_get_config (p->camera, rootconfig, p->context);
	if (ret != GP_OK) return ret;
	ret = gp_widget_get_child_by_name (*rootconfig, name, child);
	if (ret != GP_OK)
		ret = gp_widget_get_child_by_label (*rootconfig, name, child);
	if (ret != GP_OK) {
		char		*part, *s, *newname;

		newname = strdup (name);
		if (!newname)
			return GP_ERROR_NO_MEMORY;

		*child = *rootconfig;
		part = newname;
		while (part[0] == '/')
			part++;
		while (1) {
			CameraWidget *tmp;

			s = strchr (part,'/');
			if (s)
				*s='\0';
			ret = gp_widget_get_child_by_name (*child, part, &tmp);
			if (ret != GP_OK)
				ret = gp_widget_get_child_by_label (*child, part, &tmp);
			if (ret != GP_OK)
				break;
			*child = tmp;
			if (!s) {
				/* end of path */
				free (newname);
				return GP_OK;
			}
			part = s+1;
			while (part[0] == '/')
				part++;
		}
		gp_context_error (p->context, "%s not found in configuration tree.", newname);
		free (newname);
		gp_widget_free (*rootconfig);
		return GP_ERROR;
	}
	return GP_OK;
}

int
set_config_value_action (GPParams *p, const char *name, const char *value) 
{
	CameraWidget *rootconfig,*child;
	int	ret;
	CameraWidgetType	type;

	ret = _find_widget_by_name (p, name, &child, &rootconfig);
	if (ret != GP_OK)
		return ret;

	ret = gp_widget_get_type (child, &type);
	if (ret != GP_OK) {
		gp_widget_free (rootconfig);
		return ret;
	}

	switch (type) {
	case GP_WIDGET_TEXT: {		/* char *		*/
		ret = gp_widget_set_value (child, value);
		if (ret != GP_OK)
			gp_context_error (p->context, "Failed to set the value of text widget %s to %s.", name, value);
		break;
	}
	case GP_WIDGET_RANGE: {	/* float		*/
		float	f,t,b,s;

		ret = gp_widget_get_range (child, &b, &t, &s);
		if (ret != GP_OK)
			break;
		if (!sscanf (value, "%f", &f)) {
			gp_context_error (p->context, "The passed value %s is not a floating point value.", value);
			ret = GP_ERROR_BAD_PARAMETERS;
			break;
		}
		if ((f < b) || (f > t)) {
			gp_context_error (p->context, "The passed value %f is not within the expected range %f - %f.", f, b, t);
			ret = GP_ERROR_BAD_PARAMETERS;
			break;
		}
		ret = gp_widget_set_value (child, &f);
		if (ret != GP_OK)
			gp_context_error (p->context, "Failed to set the value of range widget %s to %f.", name, f);
		break;
	}
	case GP_WIDGET_TOGGLE: {	/* int		*/
		int	t;

		t = 2;
		if (	!strcasecmp (value, "off")	|| !strcasecmp (value, "no")	||
			!strcasecmp (value, "false")	|| !strcmp (value, "0")
		)
			t = 0;
		if (	!strcasecmp (value, "on")	|| !strcasecmp (value, "yes")	||
			!strcasecmp (value, "true")	|| !strcmp (value, "1")		
		)
			t = 1;
		/*fprintf (stderr," value %s, t %d\n", value, t);*/
		if (t == 2) {
			gp_context_error (p->context, "The passed value %s is not a valid toggle value.", value);
			ret = GP_ERROR_BAD_PARAMETERS;
			break;
		}
		ret = gp_widget_set_value (child, &t);
		if (ret != GP_OK)
			gp_context_error (p->context, "Failed to set values %s of toggle widget %s.", value, name);
		break;
	}
	case GP_WIDGET_DATE:  {		/* int			*/
		int	t = -1;
		struct tm xtm;

		if (!strcasecmp (value, "now") )
			t = time(NULL);
#ifdef HAVE_STRPTIME
		else if (strptime (value, "%c", &xtm) || strptime (value, "%Ec", &xtm))
			t = mktime (&xtm);
#endif
		if (t == -1) {
			if (!sscanf (value, "%d", &t)) {
				gp_context_error (p->context, "The passed value %s is neither a valid time nor an integer.", value);
				ret = GP_ERROR_BAD_PARAMETERS;
				break;
			}
		}
		ret = gp_widget_set_value (child, &t);
		if (ret != GP_OK)
			gp_context_error (p->context, "Failed to set new time of date/time widget %s to %s.", name, value);
		break;
	}
	case GP_WIDGET_MENU:
	case GP_WIDGET_RADIO: { /* char *		*/
		int cnt, i;

		cnt = gp_widget_count_choices (child);
		if (cnt < GP_OK) {
			ret = cnt;
			break;
		}
		ret = GP_ERROR_BAD_PARAMETERS;
		for ( i=0; i<cnt; i++) {
			const char *choice;

			ret = gp_widget_get_choice (child, i, &choice);
			if (ret != GP_OK)
				continue;
			if (!strcmp (choice, value)) {
				ret = gp_widget_set_value (child, value);
				break;
			}
		}
		if (i != cnt)
			break;
		/* Lets just try setting the value directly, in case we have flexible setters,
		 * like PTP shutterspeed. */
		ret = gp_widget_set_value (child, value);
		if (ret == GP_OK) break;
		gp_context_error (p->context, "Choice %s not found within list of choices.", value);
		break;
	}

	/* ignore: */
	case GP_WIDGET_WINDOW:
	case GP_WIDGET_SECTION:
	case GP_WIDGET_BUTTON:
		gp_context_error (p->context, "The %s widget is not configurable.", name);
		ret = GP_ERROR_BAD_PARAMETERS;
		break;
	}
	if (ret == GP_OK) {
		if (child == rootconfig)
			ret = gp_camera_set_single_config (p->camera, name, child, p->context);
		else
			ret = gp_camera_set_config (p->camera, rootconfig, p->context);
		if (ret != GP_OK)
			gp_context_error (p->context, "Failed to set new configuration value %s for configuration entry %s.", value, name);
	}
	gp_widget_free (rootconfig);
	return (ret);
}

int
set_config_action (GPParams *p, const char *name, const char *value) 
{
	CameraWidget *rootconfig,*child;
	int	ret, ro;
	CameraWidgetType	type;

	ret = _find_widget_by_name (p, name, &child, &rootconfig);
	if (ret != GP_OK)
		return ret;

	ret = gp_widget_get_readonly (child, &ro);
	if (ret != GP_OK) {
		gp_widget_free (rootconfig);
		return ret;
	}
	if (ro == 1) {
		gp_context_error (p->context, "Property %s is read only.", name);
		gp_widget_free (rootconfig);
		return GP_ERROR;
	}
	ret = gp_widget_get_type (child, &type);
	if (ret != GP_OK) {
		gp_widget_free (rootconfig);
		return ret;
	}

	switch (type) {
	case GP_WIDGET_TEXT: {		/* char *		*/
		ret = gp_widget_set_value (child, value);
		if (ret != GP_OK)
			gp_context_error (p->context, "Failed to set the value of text widget %s to %s.", name, value);
		break;
	}
	case GP_WIDGET_RANGE: {	/* float		*/
		float	f,t,b,s;

		ret = gp_widget_get_range (child, &b, &t, &s);
		if (ret != GP_OK)
			break;
		if (!sscanf (value, "%f", &f)) {
			gp_context_error (p->context, "The passed value %s is not a floating point value.", value);
			ret = GP_ERROR_BAD_PARAMETERS;
			break;
		}
		if ((f < b) || (f > t)) {
			gp_context_error (p->context, "The passed value %f is not within the expected range %f - %f.", f, b, t);
			ret = GP_ERROR_BAD_PARAMETERS;
			break;
		}
		ret = gp_widget_set_value (child, &f);
		if (ret != GP_OK)
			gp_context_error (p->context, "Failed to set the value of range widget %s to %f.", name, f);
		break;
	}
	case GP_WIDGET_TOGGLE: {	/* int		*/
		int	t;

		t = 2;
		if (	!strcasecmp (value, "off")	|| !strcasecmp (value, "no")	||
			!strcasecmp (value, "false")	|| !strcmp (value, "0")	
		)
			t = 0;
		if (	!strcasecmp (value, "on")	|| !strcasecmp (value, "yes")	||
			!strcasecmp (value, "true")	|| !strcmp (value, "1")		
		)
			t = 1;
		/*fprintf (stderr," value %s, t %d\n", value, t);*/
		if (t == 2) {
			gp_context_error (p->context, "The passed value %s is not a valid toggle value.", value);
			ret = GP_ERROR_BAD_PARAMETERS;
			break;
		}
		ret = gp_widget_set_value (child, &t);
		if (ret != GP_OK)
			gp_context_error (p->context, "Failed to set values %s of toggle widget %s.", value, name);
		break;
	}
	case GP_WIDGET_DATE:  {		/* int			*/
		time_t	t = -1;
		struct tm xtm;

		memset(&xtm,0,sizeof(xtm));

		/* We need to set UNIX time in seconds since Epoch */
		/* We get ... local time */

		if (!strcasecmp (value, "now"))
			t = time(NULL);
#ifdef HAVE_STRPTIME
		else if (strptime (value, "%c", &xtm) || strptime (value, "%Ec", &xtm)) {
			xtm.tm_isdst = -1;
			t = mktime (&xtm);
		}
#endif
		if (t == -1) {
			unsigned long lt;

			if (!sscanf (value, "%ld", &lt)) {
				gp_context_error (p->context, "The passed value %s is neither a valid time nor an integer.", value);
				ret = GP_ERROR_BAD_PARAMETERS;
				break;
			}
			t = lt;
		}
		ret = gp_widget_set_value (child, &t);
		if (ret != GP_OK)
			gp_context_error (p->context, "Failed to set new time of date/time widget %s to %s.", name, value);
		break;
	}
	case GP_WIDGET_MENU:
	case GP_WIDGET_RADIO: { /* char *		*/
		int cnt, i;
		char *endptr;

		cnt = gp_widget_count_choices (child);
		if (cnt < GP_OK) {
			ret = cnt;
			break;
		}
		ret = GP_ERROR_BAD_PARAMETERS;
		for ( i=0; i<cnt; i++) {
			const char *choice;

			ret = gp_widget_get_choice (child, i, &choice);
			if (ret != GP_OK)
				continue;
			if (!strcmp (choice, value)) {
				ret = gp_widget_set_value (child, value);
				break;
			}
		}
		if (i != cnt)
			break;

		/* make sure we parse just 1 integer, and there is nothing more.
		 * sscanf just does not provide this, we need strtol.
		 */
		i = strtol (value, &endptr, 10);
		if ((value != endptr) && (*endptr == '\0')) {
			if ((i>= 0) && (i < cnt)) {
				const char *choice;

				ret = gp_widget_get_choice (child, i, &choice);
				if (ret == GP_OK)
					ret = gp_widget_set_value (child, choice);
				break;
			}
		}
		/* Lets just try setting the value directly, in case we have flexible setters,
		 * like PTP shutterspeed. */
		ret = gp_widget_set_value (child, value);
		if (ret == GP_OK)
			break;
		gp_context_error (p->context, "Choice %s not found within list of choices.", value);
		break;
	}

	/* ignore: */
	case GP_WIDGET_WINDOW:
	case GP_WIDGET_SECTION:
	case GP_WIDGET_BUTTON:
		gp_context_error (p->context, "The %s widget is not configurable.", name);
		ret = GP_ERROR_BAD_PARAMETERS;
		break;
	}
	if (ret == GP_OK) {
		if (child == rootconfig)
			ret = gp_camera_set_single_config (p->camera, name, child, p->context);
		else
			ret = gp_camera_set_config (p->camera, rootconfig, p->context);
		if (ret != GP_OK)
			gp_context_error (p->context, "Failed to set new configuration value %s for configuration entry %s.", value, name);
	}
	gp_widget_free (rootconfig);
	return (ret);
}

GPContext* sample_create_context() 
{
	GPContext *context;

	/* This is the mandatory part */
	context = gp_context_new();

	/* All the parts below are optional! */
        gp_context_set_error_func (context, ctx_error_func, NULL);
        gp_context_set_status_func (context, ctx_status_func, NULL);

	/* also:
	gp_context_set_cancel_func    (p->context, ctx_cancel_func,  p);
        gp_context_set_message_func   (p->context, ctx_message_func, p);
        if (isatty (STDOUT_FILENO))
                gp_context_set_progress_funcs (p->context,
                        ctx_progress_start_func, ctx_progress_update_func,
                        ctx_progress_stop_func, p);
	 */
	return context;
}

/*
 * This enables/disables the specific canon capture mode.
 * 
 * For non canons this is not required, and will just return
 * with an error (but without negative effects).
 */
int
canon_enable_capture (GPParams *p, int onoff) 
{
	Camera *camera = p->camera;
	GPContext *context = p->context;
	CameraWidget		*widget = NULL, *child = NULL;
	CameraWidgetType	type;
	int			ret;

	ret = gp_camera_get_single_config (camera, "capture", &widget, context);
	if (ret < GP_OK) {
		fprintf (stderr, "camera_get_config failed: %d\n", ret);
		return ret;
	}

	ret = gp_widget_get_type (child, &type);
	if (ret < GP_OK) {
		fprintf (stderr, "widget get type failed: %d\n", ret);
		goto out;
	}
	switch (type) {
        case GP_WIDGET_TOGGLE:
		break;
	default:
		fprintf (stderr, "widget has bad type %d\n", type);
		ret = GP_ERROR_BAD_PARAMETERS;
		goto out;
	}
	/* Now set the toggle to the wanted value */
	ret = gp_widget_set_value (child, &onoff);
	if (ret < GP_OK) {
		fprintf (stderr, "toggling Canon capture to %d failed with %d\n", onoff, ret);
		goto out;
	}
	/* OK */
	ret = gp_camera_set_single_config (camera, "capture", widget, context);
	if (ret < GP_OK) {
		fprintf (stderr, "camera_set_config failed: %d\n", ret);
		return ret;
	}
out:
	gp_widget_free (widget);
	return ret;
}

static void capture_image_to_file(GPParams *ctx, const char *jpgname) 
{  // capture 1 preview image
  Camera *canon = ctx->camera;
  GPContext *canoncontext = ctx->context;
  CameraFile *file;
  int rslt;
  rslt  = gp_file_new(&file);
  if (rslt) {
    printf("Error creating new CameraFile %i\n",rslt);
    exit(1);
  }
  // skipping focus for now but do it here
  // skipping zoom also
  rslt = gp_camera_capture_preview(canon, file, canoncontext);
  if (rslt) {
    printf("error capturing preview %i\n",rslt);
    exit(1);
  }
  rslt = gp_file_save(file, jpgname);
  if (rslt) {
    printf("Error saving file (in %s) %i\n",jpgname, rslt);
    exit(1);
  }
}

void capture_image(void)
{
  capture_image_to_file(&ctx, "liveview.jpg");
}

void gp_params_init(GPParams *p)
{
	Camera	*canon;
	p->context = sample_create_context();
	gp_camera_new(&canon);
	p->camera = canon;
}


int init_camera(void)
{
    if( !ctx.logger_installed ) {
        gp_params_init(&ctx);
       /* When I set GP_LOG_DEBUG instead of GP_LOG_ERROR above, I noticed that the
        * init function seems to traverse the entire filesystem on the camera.  This
        * is partly why it takes so long.
        * (Marcus: the ptp2 driver does this by default currently.)
        */
        gp_log_add_func(GP_LOG_ERROR, errordumper, 0);
        ctx.logger_installed = 1;
    }
    printf("Camera init.  Takes about 10 seconds.\n");
    int retval = gp_camera_init(ctx.camera, ctx.context);
    printf("gp_camera_init(): %d\n", retval);
    return retval;
}

void exit_camera(void)
{
    gp_camera_exit(ctx.camera, ctx.context);
}

