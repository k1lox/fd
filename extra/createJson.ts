import * as fs from 'fs';
import * as path from 'path';

// 创建输出目录
const outputDir = path.join(__dirname, 'metadata');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 生成500个JSON文件
for (let i = 1; i <= 500; i++) {
  const metadata = {
    name: "FomoDoge",
    description: "FomoDoge",
    image: `https://www.fomodoge.com/pic/${i}.png`,
  };

  const jsonContent = JSON.stringify(metadata, null, 2);
  const filePath = path.join(outputDir, `${i}.json`);
  
  fs.writeFileSync(filePath, jsonContent);
  console.log(`Created ${i}.json`);
}

console.log('All 500 JSON files have been generated successfully!');
