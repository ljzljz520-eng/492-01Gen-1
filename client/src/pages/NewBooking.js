import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, Select, DatePicker, InputNumber, Switch, Radio,
  Button, Space, Row, Col, Alert, message, Divider, Tag, AutoComplete, Steps
} from 'antd';
import { SaveOutlined, ArrowLeftOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { getPets, getAvailableRooms, createBooking, createPet } from '../api';

const { Option } = Select;
const { TextArea } = Input;

function NewBooking() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [pets, setPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState(null);
  const [species, setSpecies] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [checkInDate, setCheckInDate] = useState(null);
  const [checkOutDate, setCheckOutDate] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [isNewPet, setIsNewPet] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPets = async () => {
      const list = await getPets();
      setPets(list);
    };
    fetchPets();
  }, []);

  useEffect(() => {
    const fetchRooms = async () => {
      if (checkInDate && checkOutDate) {
        const check_in = checkInDate.format('YYYY-MM-DD');
        const check_out = checkOutDate.format('YYYY-MM-DD');
        const list = await getAvailableRooms(check_in, check_out, species);
        setRooms(list);
      }
    };
    fetchRooms();
  }, [checkInDate, checkOutDate, species]);

  useEffect(() => {
    if (checkInDate && checkOutDate) {
      const nights = checkOutDate.diff(checkInDate, 'day');
      if (nights > 0) {
        const selectedRoom = form.getFieldValue('room_id');
        const room = rooms.find(r => r.id === selectedRoom);
        const basePrice = species === 'cat' ? 80 : 120;
        let price = nights * basePrice * (room?.name?.includes('VIP') ? 1.5 : 1);
        if (form.getFieldValue('grooming')) price += 150;
        if (form.getFieldValue('pickup_service')) price += 80;
        setEstimatedPrice(price);
      }
    }
  }, [checkInDate, checkOutDate, rooms, form]);

  const handlePetChange = (value) => {
    setSelectedPetId(value);
    setSelectedRoomId(null);
    if (value === 'new') {
      setIsNewPet(true);
      setSpecies(null);
    } else {
      setIsNewPet(false);
      const pet = pets.find(p => p.id === value);
      if (pet) setSpecies(pet.species);
    }
    form.setFieldsValue({ room_id: undefined });
  };

  const handleNewPetSpecies = (e) => {
    setSpecies(e.target.value);
    setSelectedRoomId(null);
    form.setFieldsValue({ room_id: undefined });
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      let petId = values.pet_id;

      if (isNewPet) {
        const petResult = await createPet({
          name: values.pet_info.name,
          species: values.pet_info.species,
          breed: values.pet_info.breed,
          age: values.pet_info.age,
          weight: values.pet_info.weight,
          gender: values.pet_info.gender,
          owner_name: values.pet_info.owner_name,
          owner_phone: values.pet_info.owner_phone,
          vaccine_expiry_date: values.pet_info.vaccine_expiry_date?.format('YYYY-MM-DD'),
          notes: values.pet_info.notes
        });
        petId = petResult.id;
      }

      const result = await createBooking({
        pet_id: petId,
        room_id: values.room_id,
        check_in_date: values.dates[0].format('YYYY-MM-DD'),
        check_out_date: values.dates[1].format('YYYY-MM-DD'),
        medication: values.medication,
        grooming: values.grooming ? 1 : 0,
        pickup_service: values.pickup_service ? 1 : 0,
        pickup_time: values.pickup_time,
        dropoff_time: values.dropoff_time,
        notes: values.notes
      });

      if (result.vaccine_warning) {
        message.warning({ content: result.vaccine_warning, duration: 5 });
      }
      message.success(`预约创建成功！预约号: ${result.booking_no}`);
      navigate(`/bookings/${result.id}`);
    } catch (e) {
      message.error(e.response?.data?.error || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const canGoNext = () => {
    if (step === 0) {
      if (isNewPet) {
        const petInfo = form.getFieldValue('pet_info');
        return petInfo?.name && petInfo?.species && petInfo?.owner_name && petInfo?.owner_phone;
      }
      return !!selectedPetId;
    }
    if (step === 1) {
      return !!(checkInDate && checkOutDate && selectedRoomId);
    }
    return true;
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Card
        style={{ borderRadius: 12, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        title={
          <Space>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/bookings')} />
            <span>新建寄养预约</span>
          </Space>
        }
      >
        <Steps
          current={step}
          style={{ marginBottom: 32 }}
          items={[
            { title: '选择宠物' },
            { title: '选择房间和日期' },
            { title: '服务配置和确认' }
          ]}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            grooming: false,
            pickup_service: false
          }}
        >
          {step === 0 && (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Form.Item
                label="选择宠物"
                name="pet_id"
                rules={[{ required: true, message: '请选择或新增宠物' }]}
              >
                <Select
                  style={{ width: '100%' }}
                  placeholder="选择已有宠物，或选择新增"
                  onChange={handlePetChange}
                  showSearch
                  optionFilterProp="label"
                >
                  <Option value="new" label="✨ 新增宠物">
                    <Tag color="blue">✨ 新增宠物</Tag>
                  </Option>
                  {pets.map(p => (
                    <Option key={p.id} value={p.id} label={`${p.name} - ${p.owner_name}`}>
                      <Space>
                        <span>{p.species === 'cat' ? '🐱' : '🐕'}</span>
                        <span style={{ fontWeight: 500 }}>{p.name}</span>
                        <Tag color={p.vaccine_valid ? 'green' : 'red'}>
                          {p.vaccine_valid ? '疫苗有效' : '疫苗过期'}
                        </Tag>
                        <span style={{ color: '#999' }}>主人: {p.owner_name}</span>
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              {isNewPet && (
                <Card size="small" title="新增宠物信息" style={{ background: '#fafafa' }}>
                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label="宠物名称"
                        name={['pet_info', 'name']}
                        rules={[{ required: true, message: '请输入宠物名称' }]}
                      >
                        <Input placeholder="例如：小白" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label="种类"
                        name={['pet_info', 'species']}
                        rules={[{ required: true, message: '请选择种类' }]}
                      >
                        <Radio.Group onChange={handleNewPetSpecies}>
                          <Radio value="cat">🐱 猫咪</Radio>
                          <Radio value="dog">🐕 狗狗</Radio>
                        </Radio.Group>
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item label="品种" name={['pet_info', 'breed']}>
                        <Input placeholder="例如：英短" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item label="年龄(岁)" name={['pet_info', 'age']}>
                        <InputNumber min={0} max={30} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item label="性别" name={['pet_info', 'gender']}>
                        <Select>
                          <Option value="male">公</Option>
                          <Option value="female">母</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label="主人姓名"
                        name={['pet_info', 'owner_name']}
                        rules={[{ required: true, message: '请输入主人姓名' }]}
                      >
                        <Input placeholder="请输入姓名" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label="联系电话"
                        name={['pet_info', 'owner_phone']}
                        rules={[{ required: true, message: '请输入联系电话' }]}
                      >
                        <Input placeholder="请输入手机号" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label="疫苗有效期至" name={['pet_info', 'vaccine_expiry_date']}>
                        <DatePicker style={{ width: '100%' }} placeholder="选择日期" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label="体重(kg)" name={['pet_info', 'weight']}>
                        <InputNumber min={0} max={100} step={0.1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item label="备注" name={['pet_info', 'notes']}>
                        <TextArea rows={2} placeholder="特殊习性、过敏史等" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              )}

              {selectedPetId && selectedPetId !== 'new' && (
                <Alert
                  type="info"
                  showIcon
                  message={
                    <Space>
                      <span>已选择宠物：</span>
                      {(() => {
                        const pet = pets.find(p => p.id === selectedPetId);
                        return pet ? (
                          <Space>
                            <b>{pet.species === 'cat' ? '🐱' : '🐕'} {pet.name}</b>
                            <span>主人: {pet.owner_name} ({pet.owner_phone})</span>
                            <Tag color={pet.vaccine_valid ? 'green' : 'red'}>
                              {pet.vaccine_valid ? '疫苗有效' : '疫苗过期'}
                            </Tag>
                          </Space>
                        ) : null;
                      })()}
                    </Space>
                  }
                />
              )}

              <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
                <Button type="primary" disabled={!canGoNext()} onClick={() => setStep(1)}>
                  下一步
                </Button>
              </Space>
            </Space>
          )}

          {step === 1 && (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Form.Item
                label="入住和离店日期"
                name="dates"
                rules={[{ required: true, message: '请选择入住和离店日期' }]}
              >
                <DatePicker.RangePicker
                  style={{ width: '100%' }}
                  size="large"
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                  onChange={(dates) => {
                    setCheckInDate(dates?.[0]);
                    setCheckOutDate(dates?.[1]);
                  }}
                />
              </Form.Item>

              {species && (
                <Form.Item
                  label={`选择${species === 'cat' ? '猫房' : '犬舍'}`}
                  name="room_id"
                  rules={[{ required: true, message: '请选择房间' }]}
                >
                  <Radio.Group
                    style={{ width: '100%' }}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                  >
                    <Row gutter={[12, 12]}>
                      {rooms.map(room => (
                        <Col xs={24} sm={12} md={8} key={room.id}>
                          <Radio.Button
                            value={room.id}
                            disabled={!room.available}
                            style={{
                              width: '100%',
                              height: 90,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: 12,
                              whiteSpace: 'normal',
                              lineHeight: 1.4,
                              textAlign: 'center',
                              border: room.available ? '2px solid #d9d9d9' : '2px dashed #d9d9d9',
                              borderRadius: 8,
                              opacity: room.available ? 1 : 0.5
                            }}
                          >
                            <Space direction="vertical" size={4}>
                              <span style={{ fontWeight: 600 }}>{room.name}</span>
                              <span style={{ fontSize: 12, color: '#999' }}>
                                {room.type === 'cat' ? '🐱' : '🐕'} 容量: {room.capacity}只
                              </span>
                              {room.name.includes('VIP') && <Tag color="gold" style={{ fontSize: 10 }}>VIP 1.5倍</Tag>}
                              <span style={{ fontSize: 11, color: room.available ? '#52c41a' : '#999' }}>
                                {room.available ? '✓ 可预订' : '✗ 已占用'}
                              </span>
                            </Space>
                          </Radio.Button>
                        </Col>
                      ))}
                    </Row>
                  </Radio.Group>
                </Form.Item>
              )}

              {!species && (
                <Alert type="warning" message="请先选择宠物以查看可用房间" />
              )}

              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Button onClick={() => setStep(0)}>上一步</Button>
                <Button type="primary" disabled={!canGoNext()} onClick={() => setStep(2)}>
                  下一步
                </Button>
              </Space>
            </Space>
          )}

          {step === 2 && (
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <Divider orientation="left">附加服务</Divider>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="喂药说明" name="medication" valuePropName="checked">
                    <TextArea
                      rows={3}
                      placeholder="如有需要喂药，请详细说明药品名称、剂量和时间"
                      onChange={(e) => {
                        form.setFieldsValue({ medication: e.target.value });
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="洗护服务" name="grooming" valuePropName="checked">
                    <Switch
                      checkedChildren="需要 +¥150"
                      unCheckedChildren="不需要"
                      onChange={() => {
                        setTimeout(() => {
                          setEstimatedPrice(prev => prev);
                        }, 100);
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="接送服务" name="pickup_service" valuePropName="checked">
                    <Switch
                      checkedChildren="需要 +¥80"
                      unCheckedChildren="不需要"
                    />
                  </Form.Item>
                </Col>
                {form.getFieldValue('pickup_service') && (
                  <>
                    <Col xs={24} sm={12}>
                      <Form.Item label="接宠时间" name="pickup_time">
                        <DatePicker showTime style={{ width: '100%' }} placeholder="选择接宠时间" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label="送回时间" name="dropoff_time">
                        <DatePicker showTime style={{ width: '100%' }} placeholder="选择送回时间" />
                      </Form.Item>
                    </Col>
                  </>
                )}
                <Col span={24}>
                  <Form.Item label="寄养备注" name="notes">
                    <TextArea rows={3} placeholder="其他特殊需求或注意事项" />
                  </Form.Item>
                </Col>
              </Row>

              <Divider />

              <Card
                size="small"
                style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8 }}
              >
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <div style={{ color: '#666', marginBottom: 8 }}>预估费用明细</div>
                    <Space direction="vertical" size={4}>
                      {checkInDate && checkOutDate && (
                        <div>
                          基础寄养: {checkOutDate.diff(checkInDate, 'day')} 晚 ×
                          ¥{species === 'cat' ? 80 : 120}
                          {rooms.find(r => r.id === form.getFieldValue('room_id'))?.name?.includes('VIP') ? ' × 1.5(VIP)' : ''}
                          = ¥{checkOutDate.diff(checkInDate, 'day') * (species === 'cat' ? 80 : 120) * (rooms.find(r => r.id === form.getFieldValue('room_id'))?.name?.includes('VIP') ? 1.5 : 1)}
                        </div>
                      )}
                      {form.getFieldValue('grooming') && <div>洗护服务: ¥150</div>}
                      {form.getFieldValue('pickup_service') && <div>接送服务: ¥80</div>}
                    </Space>
                  </Col>
                  <Col xs={24} sm={12} style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, color: '#666' }}>预估总价</div>
                    <div style={{ fontSize: 36, fontWeight: 700, color: '#52c41a' }}>
                      ¥{estimatedPrice}
                    </div>
                  </Col>
                </Row>
              </Card>

              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Button onClick={() => setStep(1)}>上一步</Button>
                <Button type="primary" size="large" icon={<SaveOutlined />} htmlType="submit" loading={loading}>
                  确认创建预约
                </Button>
              </Space>
            </Space>
          )}
        </Form>
      </Card>
    </div>
  );
}

export default NewBooking;
