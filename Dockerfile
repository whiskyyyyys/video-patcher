FROM nginx:alpine

# Copy web files to Nginx html directory
COPY . /usr/share/nginx/html

# Copy custom Nginx configuration template
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Expose default HTTP port
EXPOSE 80

# Substitute $PORT into Nginx config at runtime and start Nginx
CMD envsubst '$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'
