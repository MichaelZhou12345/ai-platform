# 上传文件说明

此目录用于存储用户上传的图片文件。

## 目录结构
- `images/` - 存储所有上传的图片文件

## 访问方式
上传的图片通过以下URL格式访问：
```
https://team-snso7aek.app.with.woa.com/static/uploads/{filename}
```

例如：
```
https://team-snso7aek.app.with.woa.com/static/uploads/img_1234567890_1234.jpg
```

## 注意事项
1. 此目录会被.gitignore忽略，不会被提交到版本控制
2. 图片文件名格式：`img_{timestamp}_{random_num}.{ext}`
3. 支持的图片格式：jpg, jpeg, png, gif, webp, bmp
4. 最大文件大小：5MB
